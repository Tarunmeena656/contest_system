import { z } from 'zod';
import { pageSchema } from './common';

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const roleBody = z.object({ role: z.enum(['user', 'vip', 'admin']) });

export const usersQuery = pageSchema.extend({ q: z.string().trim().max(100).optional() });
