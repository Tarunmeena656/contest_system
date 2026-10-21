import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { db } from '../db';
import { signToken } from '../middleware/auth';
import { AppError } from '../middleware/errors';

export const publicUser = ['id', 'name', 'email', 'role', 'created_at'];

export async function register(req: Request, res: Response) {
  const { name, email, password } = req.body;
  const taken = await db('users').where({ email }).first('id');
  if (taken) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered');
  }
  const [user] = await db('users')
    .insert({ name, email, password_hash: await bcrypt.hash(password, 10) })
    .returning(publicUser);
  req.log.info({ userId: user.id }, 'user registered');
  res.status(201).json({ token: signToken(user), user });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await db('users').where({ email }).first();
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    req.log.warn({ email }, 'failed login');
    throw new AppError(401, 'BAD_CREDENTIALS', 'Invalid email or password');
  }
  const { password_hash, ...safe } = user;
  req.log.info({ userId: user.id }, 'user logged in');
  res.json({ token: signToken(user), user: safe });
}

export async function me(req: Request, res: Response) {
  const user = await db('users').where({ id: req.user!.id }).first(publicUser);
  if (!user) {
    throw new AppError(401, 'INVALID_TOKEN', 'User no longer exists');
  }
  res.json(user);
}
