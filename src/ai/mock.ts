import { bankFor } from './questionBank';
import {
  AiProvider,
  GenerateParams,
  GeneratedQuestion,
  SearchFilters,
  normaliseDifficulty,
  questionTypes,
} from './types';

type QuestionType = (typeof questionTypes)[number];
type Difficulty = ReturnType<typeof normaliseDifficulty>;

// Deterministic stand-in for the real model. Used by the tests and whenever no
// API key is configured, so the whole system still runs end to end. Generation
// draws from a small hand-written bank for common topics and only falls back to
// obvious placeholders once the bank runs dry.
export class MockProvider implements AiProvider {
  readonly name = 'mock';

  async generateQuestions(params: GenerateParams): Promise<GeneratedQuestion[]> {
    const difficulty = normaliseDifficulty(params.difficulty);
    // questions of the requested difficulty first, then the rest (sort is stable)
    const pool = [...bankFor(params.topic)].sort(
      (a, b) => Number(b.difficulty === difficulty) - Number(a.difficulty === difficulty),
    );
    const out: GeneratedQuestion[] = [];
    for (let i = 0; i < params.count; i++) {
      const type = params.questionTypes[i % params.questionTypes.length];
      const idx = pool.findIndex((candidate) => candidate.type === type);
      if (idx === -1) {
        out.push(placeholder(params.topic, type, i + 1, difficulty));
        continue;
      }
      const [picked] = pool.splice(idx, 1);
      out.push({
        question: picked.text,
        type: picked.type,
        options: picked.options,
        correctAnswers: picked.correct,
        explanation: picked.explanation,
        difficulty,
        topic: params.topic,
      });
    }
    return out;
  }

  async parseSearch(query: string): Promise<SearchFilters> {
    const q = query.toLowerCase();
    const has = (...words: string[]) => words.some((w) => q.includes(w));
    const filters: SearchFilters = {
      status: has('active', 'ongoing', 'running', 'currently', 'live')
        ? 'active'
        : has('upcoming', 'starting', 'this week', 'next week', 'soon')
          ? 'upcoming'
          : has('past', 'ended', 'finished', 'previous')
            ? 'ended'
            : null,
      accessLevel: has('vip') ? 'vip' : has('normal', 'regular') ? 'normal' : null,
      difficulty: has('beginner', 'easy', 'intro')
        ? 'beginner'
        : has('advanced', 'hard', 'difficult', 'expert')
          ? 'advanced'
          : has('intermediate', 'medium')
            ? 'intermediate'
            : null,
      topics: ['node.js', 'nodejs', 'javascript', 'typescript', 'sql', 'postgresql', 'backend', 'frontend', 'python']
        .filter((t) => q.includes(t))
        .map((t) => (t === 'nodejs' ? 'node.js' : t)),
      hasPrize: has('prize', 'reward') ? true : null,
      startsWithinDays: has('today', 'tomorrow')
        ? 1
        : has('this week', 'next week')
          ? 7
          : has('this month')
            ? 30
            : null,
    };
    return filters;
  }
}

const NOTE =
  'Placeholder from the mock provider: the built-in bank has no more questions for this topic. Set ANTHROPIC_API_KEY to generate real ones.';

function placeholder(topic: string, type: QuestionType, n: number, difficulty: Difficulty): GeneratedQuestion {
  const base = { difficulty, topic, explanation: NOTE };
  if (type === 'true-false') {
    return {
      ...base,
      type,
      question: `${topic} statement #${n} is true.`,
      options: ['True', 'False'],
      correctAnswers: [n % 2 ? 'True' : 'False'],
    };
  }
  if (type === 'multi-select') {
    return {
      ...base,
      type,
      question: `Which of the following apply to ${topic}? (#${n})`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswers: ['Option A', 'Option C'],
    };
  }
  return {
    ...base,
    type,
    question: `What is the best description of ${topic}? (#${n})`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswers: ['Option B'],
  };
}
