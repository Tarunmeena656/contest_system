import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { ZodType } from 'zod';
import { config } from '../config';
import { logger } from '../logger';
import { AppError } from '../middleware/errors';
import {
  AiProvider,
  GenerateParams,
  GeneratedQuestion,
  SearchFilters,
  generatedQuestionsSchema,
  normaliseDifficulty,
  searchFiltersSchema,
} from './types';

const log = logger.child({ module: 'ai', provider: 'anthropic' });

const QUESTION_SYSTEM = `You write quiz questions for a programming contest platform.
Rules:
- "single-select": 4 options, exactly one correct answer.
- "multi-select": 4 to 5 options, two or more correct answers.
- "true-false": options are exactly ["True", "False"], one correct answer.
- Every entry in correctAnswers must appear verbatim in options.
- Questions must be unambiguous, factual and distinct from each other. No trick questions.
- Keep explanations to one or two sentences.`;

const SEARCH_SYSTEM = `You turn a user's natural-language request for programming contests into filters.
Fields:
- status: "active" (running now / currently / ongoing), "upcoming" (starting soon, this week, next month), "ended" (past, finished). null if not stated.
- accessLevel: "vip" or "normal" when the user says so, else null.
- difficulty: "beginner" (easy, intro), "intermediate" (medium), "advanced" (hard, difficult, expert). null if not stated.
- topics: technologies or subjects mentioned, lower-cased, e.g. ["node.js", "backend"]. Empty if none.
- hasPrize: true if the user wants contests with prizes/rewards, false if explicitly without, else null.
- startsWithinDays: 7 for "this week", 30 for "this month", 1 for "today/tomorrow", else null.
Do not invent filters the user did not ask for.`;

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic';
  private client = new Anthropic({ apiKey: config.ai.apiKey });

  async generateQuestions(params: GenerateParams): Promise<GeneratedQuestion[]> {
    const difficulty = normaliseDifficulty(params.difficulty);
    const prompt =
      `Generate ${params.count} ${difficulty} questions about "${params.topic}". ` +
      `Use only these types: ${params.questionTypes.join(', ')}. Spread the questions across those types. ` +
      `Set difficulty to "${difficulty}" and topic to "${params.topic}" on every question.`;
    const out = await this.structured('generateQuestions', QUESTION_SYSTEM, prompt, generatedQuestionsSchema, 8000);
    return out.questions.slice(0, params.count);
  }

  async parseSearch(query: string): Promise<SearchFilters> {
    return this.structured('parseSearch', SEARCH_SYSTEM, `Request: ${query}`, searchFiltersSchema, 1000);
  }

  private async structured<T>(
    op: string,
    system: string,
    prompt: string,
    schema: ZodType<T>,
    maxTokens: number,
  ): Promise<T> {
    const started = Date.now();
    try {
      const response = await this.client.messages.parse({
        model: config.ai.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
        output_config: { format: zodOutputFormat(schema) },
      });
      log.info(
        {
          op,
          model: config.ai.model,
          ms: Date.now() - started,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          stopReason: response.stop_reason,
        },
        'ai call finished',
      );
      if (response.stop_reason === 'refusal') {
        throw new AppError(422, 'AI_REFUSED', 'The model declined this request');
      }
      if (!response.parsed_output) {
        throw new AppError(502, 'AI_BAD_OUTPUT', 'The model did not return the expected structure');
      }
      return response.parsed_output;
    } catch (err) {
      if (err instanceof AppError) throw err;
      log.error({ op, err, ms: Date.now() - started }, 'ai call failed');
      if (err instanceof Anthropic.RateLimitError) {
        throw new AppError(503, 'AI_RATE_LIMITED', 'AI provider is rate limiting us, try again shortly');
      }
      if (err instanceof Anthropic.AuthenticationError) {
        throw new AppError(500, 'AI_MISCONFIGURED', 'AI provider credentials are invalid');
      }
      if (err instanceof Anthropic.APIError) {
        throw new AppError(502, 'AI_UNAVAILABLE', `AI provider error (${err.status ?? 'network'})`);
      }
      throw err;
    }
  }
}
