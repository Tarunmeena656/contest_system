import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { api, auth, createUser, resetDb } from './helpers';

beforeEach(resetDb);

describe('auth and roles', () => {
  it('registers a normal user and logs in', async () => {
    const reg = await api().post('/api/auth/register').send({ name: 'Asha', email: 'Asha@Example.com', password: 'password123' });
    expect(reg.status).toBe(201);
    expect(reg.body.user).toMatchObject({ name: 'Asha', email: 'asha@example.com', role: 'user' });
    expect(reg.body.user.password_hash).toBeUndefined();

    const dup = await api().post('/api/auth/register').send({ name: 'Asha', email: 'asha@example.com', password: 'password123' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');

    const bad = await api().post('/api/auth/login').send({ email: 'asha@example.com', password: 'nope-nope' });
    expect(bad.status).toBe(401);

    const ok = await api().post('/api/auth/login').send({ email: 'asha@example.com', password: 'password123' });
    expect(ok.status).toBe(200);
    const me = await api().get('/api/auth/me').set(auth(ok.body.token));
    expect(me.body.email).toBe('asha@example.com');
  });

  it('validates registration input with field details', async () => {
    const res = await api().post('/api/auth/register').send({ email: 'x', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(['name', 'email', 'password']);
  });

  it('rejects missing, malformed and expired tokens', async () => {
    expect((await api().get('/api/me/history')).status).toBe(401);
    expect((await api().get('/api/me/history').set({ Authorization: 'Token abc' })).status).toBe(401);
    expect((await api().get('/api/me/history').set(auth('garbage'))).body.error.code).toBe('INVALID_TOKEN');

    const user = await createUser();
    const expired = jwt.sign({ sub: user.id, role: 'user' }, process.env.JWT_SECRET!, { expiresIn: -5 });
    const res = await api().get('/api/me/history').set(auth(expired));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');

    // guests may list contests, but a broken token is still refused there
    expect((await api().get('/api/contests')).status).toBe(200);
    expect((await api().get('/api/contests').set(auth('garbage'))).status).toBe(401);
  });

  it('only admins can change roles', async () => {
    const admin = await createUser('admin');
    const user = await createUser('user');
    const other = await createUser('user');

    const forbidden = await api().patch(`/api/users/${user.id}/role`).set(auth(other.token)).send({ role: 'vip' });
    expect(forbidden.status).toBe(403);

    const promoted = await api().patch(`/api/users/${user.id}/role`).set(auth(admin.token)).send({ role: 'vip' });
    expect(promoted.status).toBe(200);
    expect(promoted.body.role).toBe('vip');

    const missing = await api().patch(`/api/users/00000000-0000-0000-0000-000000000000/role`).set(auth(admin.token)).send({ role: 'vip' });
    expect(missing.status).toBe(404);
  });

  it('returns json 404 for unknown routes', async () => {
    const res = await api().get('/api/nothing-here');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
