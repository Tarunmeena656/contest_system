import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { requireAuth, requireRole, signToken } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { validate } from '../middleware/validate';

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const publicUser = ['id', 'name', 'email', 'role', 'created_at'];

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await db('users').where({ email }).first();
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      req.log.warn({ email }, 'failed login');
      throw new AppError(401, 'BAD_CREDENTIALS', 'Invalid email or password');
    }
    const { password_hash, ...safe } = user;
    req.log.info({ userId: user.id }, 'user logged in');
    res.json({ token: signToken(user), user: safe });
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await db('users').where({ id: req.user!.id }).first(publicUser);
    if (!user) {
      throw new AppError(401, 'INVALID_TOKEN', 'User no longer exists');
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export const usersRouter = Router();

usersRouter.patch(
  '/:id/role',
  requireRole('admin'),
  validate(z.object({ role: z.enum(['user', 'vip', 'admin']) })),
  async (req, res, next) => {
    try {
      const [user] = await db('users').where({ id: req.params.id }).update({ role: req.body.role }).returning(publicUser);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }
      req.log.info({ userId: user.id, role: user.role, by: req.user!.id }, 'user role changed');
      res.json(user);
    } catch (err) {
      next(err);
    }
  },
);
