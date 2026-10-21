import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { finalizeContest, finalizeDueContests } from '../src/services/finalize';
import { addQuestions, api, auth, createContest, createUser, endContest, resetDb } from './helpers';

beforeEach(resetDb);

const hour = 60 * 60 * 1000;

async function joined(token: string, contestId: string) {
  const res = await api().post(`/api/contests/${contestId}/join`).set(auth(token));
  if (res.status >= 300) throw new Error(JSON.stringify(res.body));
  return res.body;
}

function answersFor(questions: { id: string; type: string; options: string[] }[], picks: string[][]) {
  return questions.map((q, i) => ({ questionId: q.id, selected: picks[i] }));
}

describe('joining', () => {
  it('enforces who can join and when', async () => {
    const admin = await createUser('admin');
    const user = await createUser('user');
    const vip = await createUser('vip');
    const vipOnly = await createContest(admin.token, { access_level: 'vip' });
    const upcoming = await createContest(admin.token, { start_time: new Date(Date.now() + hour), end_time: new Date(Date.now() + 2 * hour) });

    expect((await api().post(`/api/contests/${vipOnly.id}/join`)).status).toBe(401);
    const denied = await api().post(`/api/contests/${vipOnly.id}/join`).set(auth(user.token));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('VIP_ONLY');
    expect((await api().post(`/api/contests/${vipOnly.id}/join`).set(auth(vip.token))).status).toBe(201);

    const early = await api().post(`/api/contests/${upcoming.id}/join`).set(auth(vip.token));
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('CONTEST_NOT_ACTIVE');
  });

  it('is idempotent, also under concurrent requests', async () => {
    const admin = await createUser('admin');
    const user = await createUser('user');
    const contest = await createContest(admin.token);

    const results = await Promise.all(Array.from({ length: 6 }, () => api().post(`/api/contests/${contest.id}/join`).set(auth(user.token))));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 200)).toHaveLength(5);
    const rows = await db('participations').where({ contest_id: contest.id, user_id: user.id });
    expect(rows).toHaveLength(1);
  });

  it('hides questions until joined and never leaks answers to participants', async () => {
    const admin = await createUser('admin');
    const user = await createUser('user');
    const contest = await createContest(admin.token);
    await addQuestions(admin.token, contest.id);

    expect((await api().get(`/api/contests/${contest.id}/questions`)).status).toBe(401);
    const notJoined = await api().get(`/api/contests/${contest.id}/questions`).set(auth(user.token));
    expect(notJoined.status).toBe(403);

    await joined(user.token, contest.id);
    const res = await api().get(`/api/contests/${contest.id}/questions`).set(auth(user.token));
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(3);
    expect(res.body.questions[0].correct_answers).toBeUndefined();
    expect(res.body.questions[0].explanation).toBeUndefined();

    const asAdmin = await api().get(`/api/contests/${contest.id}/questions`).set(auth(admin.token));
    expect(asAdmin.body.questions[0].correct_answers).toEqual(['4']);
  });
});

describe('submitting and scoring', () => {
  it('scores single, multi and true/false questions, partial multi-select counts as wrong', async () => {
    const admin = await createUser('admin');
    const user = await createUser('user');
    const contest = await createContest(admin.token);
    const questions = await addQuestions(admin.token, contest.id);
    await joined(user.token, contest.id);

    const res = await api()
      .post(`/api/contests/${contest.id}/submit`)
      .set(auth(user.token))
      .send({ answers: answersFor(questions, [['4'], ['2'], ['True']]) });
    expect(res.status).toBe(200);
    // 1 for the single, 0 for the incomplete multi, 2 for the true/false worth 2 points
    expect(res.body).toMatchObject({ score: 3, maxScore: 4, correctCount: 2, totalQuestions: 3, rank: 1 });

    const result = await api().get(`/api/contests/${contest.id}/result`).set(auth(user.token));
    expect(result.body.answers.map((a: { is_correct: boolean }) => a.is_correct)).toEqual([true, false, true]);
    expect(result.body.answers[1].correct_answers).toEqual(['2', '4']);
  });

  it('rejects bad answers, double submits and submits after the end', async () => {
    const admin = await createUser('admin');
    const user = await createUser('user');
    const contest = await createContest(admin.token);
    const questions = await addQuestions(admin.token, contest.id);

    const notJoined = await api().post(`/api/contests/${contest.id}/submit`).set(auth(user.token)).send({ answers: [] });
    expect(notJoined.body.error.code).toBe('NOT_JOINED');

    await joined(user.token, contest.id);
    const submit = (answers: unknown) => api().post(`/api/contests/${contest.id}/submit`).set(auth(user.token)).send({ answers });

    expect((await submit([{ questionId: questions[0].id, selected: ['7'] }])).body.error.code).toBe('INVALID_OPTION');
    expect((await submit([{ questionId: questions[0].id, selected: ['3', '4'] }])).body.error.code).toBe('INVALID_OPTION');
    expect((await submit([{ questionId: '00000000-0000-0000-0000-000000000000', selected: ['4'] }])).body.error.code).toBe('UNKNOWN_QUESTION');
    expect((await submit([{ questionId: questions[0].id, selected: ['4'] }, { questionId: questions[0].id, selected: ['4'] }])).body.error.code).toBe('DUPLICATE_ANSWER');

    // unanswered questions just score zero
    const partial = await submit([{ questionId: questions[0].id, selected: ['4'] }]);
    expect(partial.status).toBe(200);
    expect(partial.body.score).toBe(1);

    const again = await submit([{ questionId: questions[0].id, selected: ['4'] }]);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_SUBMITTED');

    const other = await createUser('user');
    await joined(other.token, contest.id);
    await endContest(contest.id);
    const late = await api().post(`/api/contests/${contest.id}/submit`).set(auth(other.token)).send({ answers: [] });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('CONTEST_NOT_ACTIVE');
  });

  it('accepts exactly one of several concurrent submissions', async () => {
    const admin = await createUser('admin');
    const user = await createUser('user');
    const contest = await createContest(admin.token);
    const questions = await addQuestions(admin.token, contest.id);
    await joined(user.token, contest.id);

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        api().post(`/api/contests/${contest.id}/submit`).set(auth(user.token)).send({ answers: answersFor(questions, [['4'], ['2', '4'], ['True']]) }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await db('answers').count('* as c').first()).toMatchObject({ c: '3' });
  });
});

describe('leaderboard, prizes and history', () => {
  async function play(token: string, contestId: string, questions: { id: string; type: string; options: string[] }[], picks: string[][]) {
    await joined(token, contestId);
    return api().post(`/api/contests/${contestId}/submit`).set(auth(token)).send({ answers: answersFor(questions, picks) });
  }

  it('ranks by score then by earlier submission, and awards the prize once', async () => {
    const admin = await createUser('admin');
    const [a, b, c] = await Promise.all([createUser('user'), createUser('user'), createUser('user')]);
    const contest = await createContest(admin.token, { prize: 'Golden mug' });
    const questions = await addQuestions(admin.token, contest.id);

    await play(a.token, contest.id, questions, [['4'], ['2'], ['False']]); // 1 point
    await play(b.token, contest.id, questions, [['4'], ['2', '4'], ['True']]); // 4 points, first
    await play(c.token, contest.id, questions, [['4'], ['2', '4'], ['True']]); // 4 points, second

    const board = await api().get(`/api/contests/${contest.id}/leaderboard`).set(auth(c.token));
    expect(board.body.items.map((r: { user_id: string; rank: number }) => [r.user_id, r.rank])).toEqual([[b.id, 1], [c.id, 2], [a.id, 3]]);
    expect(board.body.me).toMatchObject({ user_id: c.id, rank: 2 });
    expect(board.body.total).toBe(3);

    const tooEarly = await api().post(`/api/contests/${contest.id}/finalize`).set(auth(admin.token));
    expect(tooEarly.body.error.code).toBe('CONTEST_NOT_ENDED');

    await endContest(contest.id);
    const [first, second] = await Promise.all([finalizeContest(contest.id), finalizeContest(contest.id)]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect([first, second].find(Boolean)).toMatchObject({ winnerUserId: b.id, prize: 'Golden mug' });
    expect(await finalizeDueContests()).toEqual([]);
    expect(await db('prizes').where({ contest_id: contest.id })).toHaveLength(1);

    const prizes = await api().get('/api/me/prizes').set(auth(b.token));
    expect(prizes.body.items).toHaveLength(1);
    expect(prizes.body.items[0]).toMatchObject({ prize: 'Golden mug', contest_name: 'Test contest' });
    expect((await api().get('/api/me/prizes').set(auth(c.token))).body.items).toHaveLength(0);

    const history = await api().get('/api/me/history').set(auth(b.token));
    expect(history.body.items[0]).toMatchObject({ contest_id: contest.id, score: 4, rank: 1, won: true, status: 'ended' });
    const historyC = await api().get('/api/me/history').set(auth(c.token));
    expect(historyC.body.items[0]).toMatchObject({ rank: 2, won: false });

    const overall = await api().get('/api/leaderboard').set(auth(a.token));
    expect(overall.body.items[0]).toMatchObject({ user_id: b.id, total_score: 4, contests_played: 1, prizes_won: 1, rank: 1 });
    expect(overall.body.me).toMatchObject({ user_id: a.id, rank: 3 });
  });

  it('shows in-progress contests and marks missed ones', async () => {
    const admin = await createUser('admin');
    const user = await createUser('user');
    const active = await createContest(admin.token, { name: 'Still going' });
    const ending = await createContest(admin.token, { name: 'Will end' });
    await joined(user.token, active.id);
    await joined(user.token, ending.id);
    await endContest(ending.id);

    const res = await api().get('/api/me/in-progress').set(auth(user.token));
    expect(res.body.items.map((i: { name: string; missed: boolean }) => [i.name, i.missed])).toEqual([['Will end', true], ['Still going', false]]);
    expect((await api().get('/api/me/history').set(auth(user.token))).body.items).toHaveLength(0);
  });

  it('worker finalizes every ended contest and skips ones without players', async () => {
    const admin = await createUser('admin');
    const empty = await createContest(admin.token, { name: 'Nobody came', prize: 'Nothing' });
    const live = await createContest(admin.token, { name: 'Live' });
    await endContest(empty.id);

    const done = await finalizeDueContests();
    expect(done).toHaveLength(1);
    expect(done[0]).toMatchObject({ contestId: empty.id, winnerUserId: null, prize: null });
    expect((await db('contests').where({ id: live.id }).first()).finalized_at).toBeNull();
    expect(await db('prizes')).toHaveLength(0);
  });
});
