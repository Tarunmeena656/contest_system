import { AppError } from '../middleware/errors';

export type QuestionType = 'single-select' | 'multi-select' | 'true-false';

export interface QuestionRow {
  id: string;
  contest_id: string;
  type: QuestionType;
  text: string;
  options: string[];
  correct_answers: string[];
  explanation: string | null;
  points: number;
  position: number;
}

export interface SubmittedAnswer {
  questionId: string;
  selected: string[];
}

export function isCorrect(question: QuestionRow, selected: string[]): boolean {
  const wanted = new Set(question.correct_answers);
  const got = new Set(selected);
  if (question.type === 'multi-select') {
    return got.size === wanted.size && [...got].every((s) => wanted.has(s));
  }
  return got.size === 1 && wanted.has([...got][0]);
}

// Correct answers add their points, everything else adds nothing. A question
// left unanswered simply scores zero.
export function scoreSubmission(questions: QuestionRow[], answers: SubmittedAnswer[]) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q) {
      throw new AppError(400, 'UNKNOWN_QUESTION', `Question ${a.questionId} is not part of this contest`);
    }
    if (seen.has(a.questionId)) {
      throw new AppError(400, 'DUPLICATE_ANSWER', `Question ${a.questionId} was answered twice`);
    }
    seen.add(a.questionId);
    const bad = a.selected.filter((s) => !q.options.includes(s));
    if (bad.length) {
      throw new AppError(400, 'INVALID_OPTION', `Not an option for question ${a.questionId}: ${bad.join(', ')}`);
    }
    if (q.type !== 'multi-select' && a.selected.length > 1) {
      throw new AppError(400, 'INVALID_OPTION', `Question ${a.questionId} takes a single answer`);
    }
  }

  const selectedById = new Map(answers.map((a) => [a.questionId, a.selected]));
  let score = 0;
  let maxScore = 0;
  const results = questions.map((q) => {
    const selected = selectedById.get(q.id) ?? [];
    const correct = selected.length > 0 && isCorrect(q, selected);
    maxScore += q.points;
    if (correct) score += q.points;
    return { questionId: q.id, selected, isCorrect: correct };
  });
  return { score, maxScore, correctCount: results.filter((r) => r.isCorrect).length, results };
}
