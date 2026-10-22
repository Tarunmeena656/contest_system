import { Request, Response } from 'express';
import { db } from '../db';
import { AppError } from '../middleware/errors';
import { publicUser } from './auth';

// admin only: find accounts by name or email, newest first
export async function list(req: Request, res: Response) {
  const { page, pageSize, q } = res.locals.query;
  const base = db('users');
  if (q) {
    base.where((b) => b.whereILike('email', `%${q}%`).orWhereILike('name', `%${q}%`));
  }
  const [{ total }] = await base.clone().count<{ total: string }[]>('* as total');
  const items = await base
    .clone()
    .select(publicUser)
    .orderBy('created_at', 'desc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  res.json({ items, total: Number(total), page, pageSize });
}

// admin only. new accounts are always "user"; this is the one way up to vip or admin.
export async function changeRole(req: Request, res: Response) {
  const [user] = await db('users').where({ id: req.params.id }).update({ role: req.body.role }).returning(publicUser);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  req.log.info({ userId: user.id, role: user.role, by: req.user!.id }, 'user role changed');
  res.json(user);
}
