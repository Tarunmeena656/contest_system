import { z } from 'zod';

export const submitBody = z.object({
  answers: z.array(z.object({ questionId: z.string().uuid(), selected: z.array(z.string()).max(6) })).max(200),
});
