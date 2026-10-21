import { z } from 'zod';
import { questionTypes } from '../ai/types';

export const questionBody = z
  .object({
    type: z.enum(questionTypes),
    text: z.string().trim().min(5).max(2000),
    options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
    correct_answers: z.array(z.string().trim().min(1)).min(1),
    explanation: z.string().trim().max(2000).nullable().default(null),
    points: z.number().int().min(1).max(100).default(1),
  })
  .superRefine((q, ctx) => {
    const unique = new Set(q.options);
    if (unique.size !== q.options.length) {
      ctx.addIssue({ code: 'custom', message: 'options must be unique', path: ['options'] });
    }
    if (q.correct_answers.some((a) => !unique.has(a))) {
      ctx.addIssue({
        code: 'custom',
        message: 'every correct answer must be one of the options',
        path: ['correct_answers'],
      });
    }
    if (q.type === 'true-false' && (q.options.length !== 2 || q.options.join() !== 'True,False')) {
      ctx.addIssue({
        code: 'custom',
        message: 'true-false options must be exactly ["True", "False"]',
        path: ['options'],
      });
    }
    if (q.type !== 'multi-select' && q.correct_answers.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: `${q.type} needs exactly one correct answer`,
        path: ['correct_answers'],
      });
    }
  });

export type QuestionInput = z.infer<typeof questionBody>;

export const questionsBody = z.object({ questions: z.array(questionBody).min(1).max(50) });
