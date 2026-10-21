import { z } from 'zod';

export const questionTypes = ['single-select', 'multi-select', 'true-false'] as const;
export const difficulties = ['beginner', 'intermediate', 'advanced'] as const;

export const generateParamsSchema = z.object({
  topic: z.string().trim().min(2).max(100),
  difficulty: z.enum(['easy', 'medium', 'hard', ...difficulties]).default('intermediate'),
  count: z.number().int().min(1).max(20).default(5),
  questionTypes: z
    .array(z.enum(questionTypes))
    .min(1)
    .default([...questionTypes]),
  save: z.boolean().default(true),
});
export type GenerateParams = z.infer<typeof generateParamsSchema>;

export const generatedQuestionSchema = z.object({
  question: z.string().min(5),
  type: z.enum(questionTypes),
  options: z.array(z.string().min(1)).min(2).max(6),
  correctAnswers: z.array(z.string().min(1)).min(1),
  explanation: z.string(),
  difficulty: z.enum(difficulties),
  topic: z.string(),
});
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export const generatedQuestionsSchema = z.object({ questions: z.array(generatedQuestionSchema) });

// What the natural-language search gets reduced to. Everything is optional;
// null means "the query did not say".
export const searchFiltersSchema = z.object({
  status: z.enum(['active', 'upcoming', 'ended']).nullable(),
  accessLevel: z.enum(['normal', 'vip']).nullable(),
  difficulty: z.enum(difficulties).nullable(),
  topics: z.array(z.string()),
  hasPrize: z.boolean().nullable(),
  startsWithinDays: z.number().int().min(1).max(365).nullable(),
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export interface AiProvider {
  readonly name: string;
  generateQuestions(params: GenerateParams): Promise<GeneratedQuestion[]>;
  parseSearch(query: string): Promise<SearchFilters>;
}

export function normaliseDifficulty(d: GenerateParams['difficulty']): (typeof difficulties)[number] {
  if (d === 'easy') return 'beginner';
  if (d === 'medium') return 'intermediate';
  if (d === 'hard') return 'advanced';
  return d;
}
