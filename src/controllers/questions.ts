import { Request, Response } from 'express';
import { z } from 'zod';
import { getAi } from '../ai';
import { generateParamsSchema } from '../ai/types';
import { db } from '../db';
import { AppError } from '../middleware/errors';
import { getContest } from '../services/contests';
import { insertQuestions, isUsable, toQuestion } from '../services/questions';
import { QuestionRow } from '../services/scoring';

export async function add(req: Request, res: Response) {
  const contest = await getContest(req.params.id);
  const questions = await insertQuestions(contest.id, req.body.questions);
  req.log.info({ contestId: contest.id, count: questions.length, by: req.user!.id }, 'questions added');
  res.status(201).json({ questions });
}

// admins always get the answers; participants only after joining, and without them
export async function list(req: Request, res: Response) {
  const contest = await getContest(req.params.id);
  const questions = await db<QuestionRow>('questions').where({ contest_id: contest.id }).orderBy('position');
  if (req.user!.role === 'admin') {
    res.json({ questions });
    return;
  }
  const joined = await db('participations').where({ contest_id: contest.id, user_id: req.user!.id }).first('id');
  if (!joined) {
    throw new AppError(403, 'NOT_JOINED', 'Join the contest to see its questions');
  }
  res.json({ questions: questions.map(({ correct_answers, explanation, ...q }) => q) });
}

export async function generate(req: Request, res: Response) {
  const contest = await getContest(req.params.id);
  const params = req.body as z.infer<typeof generateParamsSchema>;
  const ai = getAi();
  const generated = await ai.generateQuestions(params);

  const valid = generated.filter(isUsable);
  const rejected = generated.length - valid.length;
  if (!valid.length) {
    throw new AppError(502, 'AI_BAD_OUTPUT', 'The model produced no usable questions, try again');
  }
  const saved = params.save ? await insertQuestions(contest.id, valid.map(toQuestion)) : [];
  req.log.info(
    {
      contestId: contest.id,
      topic: params.topic,
      requested: params.count,
      generated: generated.length,
      rejected,
      saved: saved.length,
      provider: ai.name,
    },
    'questions generated',
  );
  res.status(params.save ? 201 : 200).json({
    provider: ai.name,
    requested: params.count,
    generated: valid.length,
    rejected,
    saved: params.save,
    questions: params.save ? saved : valid.map((q) => ({ ...toQuestion(q), difficulty: q.difficulty, topic: q.topic })),
  });
}
