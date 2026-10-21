import { beforeEach, describe, expect, it } from 'vitest';
import { addQuestions, api, auth, createContest, createUser, resetDb } from './helpers';

beforeEach(resetDb);

const hour = 60 * 60 * 1000;

describe('contests', () => {
  it('admin creates, updates and deletes a contest; others cannot', async () => {
    const admin = await createUser('admin');
    const vip = await createUser('vip');

    const denied = await api()
      .post('/api/contests')
      .set(auth(vip.token))
      .send({ name: 'Nope', start_time: new Date(), end_time: new Date(Date.now() + hour) });
    expect(denied.status).toBe(403);

    const bad = await api()
      .post('/api/contests')
      .set(auth(admin.token))
      .send({ name: 'Backwards', start_time: new Date(), end_time: new Date(Date.now() - hour) });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].field).toBe('end_time');

    const contest = await createContest(admin.token, { name: 'Node.js Deep Dive', tags: ['Node.js', 'backend'] });
    expect(contest).toMatchObject({
      access_level: 'normal',
      difficulty: 'intermediate',
      tags: ['node.js', 'backend'],
      status: 'active',
    });

    const patched = await api()
      .patch(`/api/contests/${contest.id}`)
      .set(auth(admin.token))
      .send({ access_level: 'vip' });
    expect(patched.status).toBe(200);
    // only the named field changes, the rest keeps its value (no create-time defaults sneaking in)
    expect(patched.body).toMatchObject({
      access_level: 'vip',
      prize: 'A sticker',
      tags: ['node.js', 'backend'],
      difficulty: 'intermediate',
    });
    const cleared = await api().patch(`/api/contests/${contest.id}`).set(auth(admin.token)).send({ prize: null });
    expect(cleared.body.prize).toBeNull();
    const badPatch = await api()
      .patch(`/api/contests/${contest.id}`)
      .set(auth(admin.token))
      .send({ end_time: new Date(Date.now() - 5 * hour) });
    expect(badPatch.status).toBe(400);

    const detail = await api().get(`/api/contests/${contest.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      can_participate: false,
      question_count: 0,
      participant_count: 0,
      my_participation: null,
    });

    expect((await api().delete(`/api/contests/${contest.id}`).set(auth(vip.token))).status).toBe(403);
    expect((await api().delete(`/api/contests/${contest.id}`).set(auth(admin.token))).status).toBe(204);
    expect((await api().get(`/api/contests/${contest.id}`)).status).toBe(404);
  });

  it('lists with status, access, tag and full-text filters', async () => {
    const admin = await createUser('admin');
    await createContest(admin.token, { name: 'Active JS', tags: ['javascript'] });
    await createContest(admin.token, {
      name: 'VIP Node',
      access_level: 'vip',
      tags: ['node.js'],
      difficulty: 'advanced',
    });
    await createContest(admin.token, {
      name: 'Soon SQL',
      tags: ['sql'],
      start_time: new Date(Date.now() + hour),
      end_time: new Date(Date.now() + 2 * hour),
    });
    await createContest(admin.token, {
      name: 'Old Python',
      tags: ['python'],
      start_time: new Date(Date.now() - 3 * hour),
      end_time: new Date(Date.now() - hour),
      prize: null,
    });

    const names = async (query: string) =>
      (await api().get(`/api/contests?${query}`)).body.items.map((c: { name: string }) => c.name);
    expect(await names('')).toHaveLength(4);
    expect((await names('status=active')).sort()).toEqual(['Active JS', 'VIP Node']);
    expect(await names('status=upcoming')).toEqual(['Soon SQL']);
    expect(await names('status=ended')).toEqual(['Old Python']);
    expect(await names('access=vip')).toEqual(['VIP Node']);
    expect(await names('difficulty=advanced')).toEqual(['VIP Node']);
    expect(await names('tag=SQL')).toEqual(['Soon SQL']);
    expect(await names('q=python')).toEqual(['Old Python']);
    expect(await names('pageSize=1&page=2')).toHaveLength(1);
    expect((await api().get('/api/contests?status=later')).status).toBe(400);
  });

  it('shows who can participate per role', async () => {
    const admin = await createUser('admin');
    const vip = await createUser('vip');
    const user = await createUser('user');
    const normal = await createContest(admin.token, { name: 'Normal one' });
    const vipOnly = await createContest(admin.token, { name: 'VIP one', access_level: 'vip' });

    const can = async (token: string | null, id: string) => {
      const req = api().get(`/api/contests/${id}`);
      const res = token ? await req.set(auth(token)) : await req;
      return res.body.can_participate;
    };
    expect(await can(null, normal.id)).toBe(false);
    expect(await can(user.token, normal.id)).toBe(true);
    expect(await can(user.token, vipOnly.id)).toBe(false);
    expect(await can(vip.token, vipOnly.id)).toBe(true);
    expect(await can(admin.token, vipOnly.id)).toBe(true);
  });

  it('validates questions per type', async () => {
    const admin = await createUser('admin');
    const contest = await createContest(admin.token);
    const post = (questions: unknown[]) =>
      api().post(`/api/contests/${contest.id}/questions`).set(auth(admin.token)).send({ questions });

    const res = await post([
      { type: 'single-select', text: 'Two correct?', options: ['a', 'b'], correct_answers: ['a', 'b'] },
      { type: 'true-false', text: 'Wrong options', options: ['Yes', 'No'], correct_answers: ['Yes'] },
      { type: 'multi-select', text: 'Answer not an option', options: ['a', 'b'], correct_answers: ['z'] },
      { type: 'single-select', text: 'Duplicate options', options: ['a', 'a'], correct_answers: ['a'] },
    ]);
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toContain('questions.0.correct_answers');
    expect(fields).toContain('questions.1.options');
    expect(fields).toContain('questions.2.correct_answers');
    expect(fields).toContain('questions.3.options');

    const questions = await addQuestions(admin.token, contest.id);
    expect(questions.map((q) => q.type)).toEqual(['single-select', 'multi-select', 'true-false']);
    const more = await addQuestions(admin.token, contest.id, [
      { type: 'single-select', text: 'Fifth one?', options: ['x', 'y'], correct_answers: ['x'] },
    ]);
    expect((more[0] as { position: number }).position).toBe(4);
  });
});
