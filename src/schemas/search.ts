import { z } from 'zod';
import { pageSchema } from './common';

export const searchQuery = pageSchema.extend({ q: z.string().trim().min(2).max(300) });
