import { z } from 'zod';
import { pageSchema } from './common';

const contestFields = {
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000),
  access_level: z.enum(['normal', 'vip']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(10),
  prize: z.string().trim().max(300).nullable(),
  start_time: z.coerce.date(),
  end_time: z.coerce.date(),
};

export const contestBody = z
  .object({
    ...contestFields,
    description: contestFields.description.default(''),
    access_level: contestFields.access_level.default('normal'),
    difficulty: contestFields.difficulty.default('intermediate'),
    tags: contestFields.tags.default([]),
    prize: contestFields.prize.default(null),
  })
  .refine((c) => c.end_time > c.start_time, { message: 'end_time must be after start_time', path: ['end_time'] });

// no defaults here on purpose: a PATCH must only touch the fields it names.
// the start/end check happens against the merged row in the controller.
export const contestPatch = z.object(contestFields).partial();

export const listQuery = pageSchema.extend({
  status: z.enum(['upcoming', 'active', 'ended']).optional(),
  access: z.enum(['normal', 'vip']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  tag: z.string().trim().toLowerCase().optional(),
  q: z.string().trim().max(200).optional(),
});
