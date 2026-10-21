import { beforeEach, describe, expect, it } from 'vitest';
import { getAi } from '../src/ai';
import { toContestFilters } from '../src/services/search';
import { api, auth, createContest, createUser, resetDb } from './helpers';

beforeEach(resetDb);

const hour = 60 * 60 * 1000;

describe('natural-language contest search', () => {
  it('turns sentences into filters', async () => {
    const ai = getAi();
    expect(ai.name).toBe('mock');
    expect(await ai.parseSearch('Show me active VIP contests')).toMatchObject({ status: 'active', accessLevel: 'vip' });
    expect(await ai.parseSearch('Find beginner contests about Node.js')).toMatchObject({ difficulty: 'beginner', topics: ['node.js'] });
    expect(await ai.parseSearch('I want a difficult JavaScript contest starting this week')).toMatchObject({
      difficulty: 'advanced',
      topics: ['javascript'],
      status: 'upcoming',
      startsWithinDays: 7,
    });
    expect(await ai.parseSearch('contests related to backend development with prizes')).toMatchObject({ topics: ['backend'], hasPrize: true });
    expect(toContestFilters(await ai.parseSearch('find normal contests that are currently active'))).toEqual({
      status: 'active',
      access: 'normal',
      difficulty: undefined,
      tags: undefined,
      hasPrize: undefined,
      startsWithinDays: undefined,
    });
  });

  it('searches through the api, with caching and a tag fallback', async () => {
    const admin = await createUser('admin');
    await createContest(admin.token, { name: 'Node.js Backend Challenge', access_level: 'vip', tags: ['node.js', 'backend'] });
    await createContest(admin.token, { name: 'JS for beginners', difficulty: 'beginner', tags: ['javascript'] });
    await createContest(admin.token, { name: 'Old Node', tags: ['node.js'], start_time: new Date(Date.now() - 3 * hour), end_time: new Date(Date.now() - hour) });
    await createContest(admin.token, { name: 'Python with no tags', tags: [], description: 'All about python scripting' });

    const search = (q: string) => api().get('/api/contests/search').query({ q });

    const vip = await search('Show me active VIP contests');
    expect(vip.status).toBe(200);
    expect(vip.body.items.map((c: { name: string }) => c.name)).toEqual(['Node.js Backend Challenge']);
    expect(vip.body.filters).toMatchObject({ status: 'active', accessLevel: 'vip' });
    expect(vip.body.cached).toBe(false);

    const again = await search('show me   ACTIVE vip contests');
    expect(again.body.cached).toBe(true);

    const node = await search('active contests about node.js with prizes');
    expect(node.body.items.map((c: { name: string }) => c.name)).toEqual(['Node.js Backend Challenge']);

    // no tag matches "python", so it falls back to full-text search on name/description
    const py = await search('python contests');
    expect(py.body.relaxed).toBe(true);
    expect(py.body.items.map((c: { name: string }) => c.name)).toEqual(['Python with no tags']);

    expect((await api().get('/api/contests/search').query({ q: 'x' })).status).toBe(400);
  });

  it('rate limits the search endpoint per user', async () => {
    const user = await createUser('user');
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await api().get('/api/contests/search').query({ q: `query number ${i}` }).set(auth(user.token))).status);
    }
    // RATE_LIMIT_AI_MAX=5 in .env.test
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});

describe('ai question generation', () => {
  it('generates, validates and stores questions for admins only', async () => {
    const admin = await createUser('admin');
    const vip = await createUser('vip');
    const contest = await createContest(admin.token);
    const body = { topic: 'JavaScript', difficulty: 'medium', count: 5, questionTypes: ['single-select', 'multi-select', 'true-false'] };

    expect((await api().post(`/api/contests/${contest.id}/questions/generate`).set(auth(vip.token)).send(body)).status).toBe(403);

    const preview = await api().post(`/api/contests/${contest.id}/questions/generate`).set(auth(admin.token)).send({ ...body, save: false });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ provider: 'mock', requested: 5, generated: 5, rejected: 0, saved: false });
    expect(preview.body.questions.map((q: { type: string }) => q.type)).toEqual(['single-select', 'multi-select', 'true-false', 'single-select', 'multi-select']);
    expect(await api().get(`/api/contests/${contest.id}/questions`).set(auth(admin.token)).then((r) => r.body.questions)).toHaveLength(0);

    const saved = await api().post(`/api/contests/${contest.id}/questions/generate`).set(auth(admin.token)).send({ ...body, count: 2 });
    expect(saved.status).toBe(201);
    expect(saved.body.questions).toHaveLength(2);
    expect(saved.body.questions[0]).toMatchObject({ contest_id: contest.id, position: 1, type: 'single-select' });
    expect(saved.body.questions[1]).toMatchObject({ position: 2, type: 'multi-select', correct_answers: ['Option A', 'Option C'] });

    const tooMany = await api().post(`/api/contests/${contest.id}/questions/generate`).set(auth(admin.token)).send({ ...body, count: 50 });
    expect(tooMany.status).toBe(400);
  });
});
