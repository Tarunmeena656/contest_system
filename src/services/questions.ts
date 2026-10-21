import { z } from 'zod';
import { generatedQuestionSchema, normaliseDifficulty } from '../ai/types';
import { db } from '../db';
import { QuestionInput, questionBody } from '../schemas/question';
import { QuestionRow } from './scoring';

type Generated = z.infer<typeof generatedQuestionSchema>;

// appends questions after the contest's current last position
export async function insertQuestions(contestId: string, questions: QuestionInput[]): Promise<QuestionRow[]> {
  return db.transaction(async (trx) => {
    const [{ max }] = await trx('questions').where({ contest_id: contestId }).max('position as max');
    let position = Number(max ?? 0);
    const rows = questions.map((q) => ({
      contest_id: contestId,
      type: q.type,
      text: q.text,
      options: JSON.stringify(q.options),
      correct_answers: JSON.stringify(q.correct_answers),
      explanation: q.explanation,
      points: q.points,
      position: ++position,
    }));
    return trx('questions').insert(rows).returning<QuestionRow[]>('*');
  });
}

// model output in the shape of a hand-written question
export function toQuestion(q: Generated): QuestionInput {
  return {
    type: q.type,
    text: q.question,
    options: q.type === 'true-false' ? ['True', 'False'] : q.options,
    correct_answers:
      q.type === 'true-false'
        ? q.correctAnswers.map((a) => (a.toLowerCase() === 'true' ? 'True' : 'False'))
        : q.correctAnswers,
    explanation: q.explanation || null,
    points: normaliseDifficulty(q.difficulty) === 'advanced' ? 2 : 1,
  };
}

// never trust model output blindly: it has to pass the same checks as an admin's question
export function isUsable(q: Generated): boolean {
  return generatedQuestionSchema.safeParse(q).success && questionBody.safeParse(toQuestion(q)).success;
}
