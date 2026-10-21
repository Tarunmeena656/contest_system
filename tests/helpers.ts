import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { db } from '../src/db';
import { Role, signToken } from '../src/middleware/auth';
import { clearSearchCache } from '../src/services/search';

export const api = () => request(app);

export async function resetDb() {
  await db.raw('truncate table users, contests restart identity cascade');
  clearSearchCache();
}

let n = 0;
const hash = bcrypt.hashSync('password123', 4);

export async function createUser(role: Role = 'user') {
  n += 1;
  const [user] = await db('users')
    .insert({ name: `${role} ${n}`, email: `${role}${n}-${Date.now()}@example.com`, password_hash: hash, role })
    .returning('*');
  return { ...user, token: signToken(user) };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const hour = 60 * 60 * 1000;

export async function createContest(adminToken: string, overrides: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/contests')
    .set(auth(adminToken))
    .send({
      name: 'Test contest',
      description: 'A contest for the tests',
      tags: ['javascript'],
      prize: 'A sticker',
      start_time: new Date(Date.now() - hour),
      end_time: new Date(Date.now() + hour),
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(`createContest failed: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export const sampleQuestions = [
  { type: 'single-select', text: 'What is 2 + 2?', options: ['3', '4', '5'], correct_answers: ['4'] },
  { type: 'multi-select', text: 'Which are even?', options: ['1', '2', '3', '4'], correct_answers: ['2', '4'] },
  { type: 'true-false', text: 'The sky is blue.', options: ['True', 'False'], correct_answers: ['True'], points: 2 },
];

export async function addQuestions(adminToken: string, contestId: string, questions = sampleQuestions) {
  const res = await api().post(`/api/contests/${contestId}/questions`).set(auth(adminToken)).send({ questions });
  if (res.status !== 201) {
    throw new Error(`addQuestions failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.questions as { id: string; type: string; options: string[] }[];
}

export async function endContest(contestId: string) {
  await db('contests')
    .where({ id: contestId })
    .update({ start_time: new Date(Date.now() - 3 * hour), end_time: new Date(Date.now() - hour) });
}
