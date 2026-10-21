import { AiProvider, GenerateParams, GeneratedQuestion, SearchFilters, normaliseDifficulty } from './types';

// Deterministic stand-in for the real model. Used by the tests and whenever no
// API key is configured, so the whole system still runs end to end.
export class MockProvider implements AiProvider {
  readonly name = 'mock';

  async generateQuestions(params: GenerateParams): Promise<GeneratedQuestion[]> {
    const difficulty = normaliseDifficulty(params.difficulty);
    const out: GeneratedQuestion[] = [];
    for (let i = 0; i < params.count; i++) {
      const type = params.questionTypes[i % params.questionTypes.length];
      const n = i + 1;
      if (type === 'true-false') {
        out.push({
          question: `${params.topic} statement #${n} is true.`,
          type,
          options: ['True', 'False'],
          correctAnswers: [n % 2 ? 'True' : 'False'],
          explanation: `Generated ${difficulty} true/false question about ${params.topic}.`,
          difficulty,
          topic: params.topic,
        });
      } else if (type === 'multi-select') {
        out.push({
          question: `Which of the following apply to ${params.topic}? (#${n})`,
          type,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswers: ['Option A', 'Option C'],
          explanation: `Generated ${difficulty} multi-select question about ${params.topic}.`,
          difficulty,
          topic: params.topic,
        });
      } else {
        out.push({
          question: `What is the best description of ${params.topic}? (#${n})`,
          type,
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswers: ['Option B'],
          explanation: `Generated ${difficulty} single-select question about ${params.topic}.`,
          difficulty,
          topic: params.topic,
        });
      }
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
      startsWithinDays: has('today', 'tomorrow') ? 1 : has('this week', 'next week') ? 7 : has('this month') ? 30 : null,
    };
    return filters;
  }
}
