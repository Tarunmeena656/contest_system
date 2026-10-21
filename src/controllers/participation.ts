import { Request, Response } from 'express';
import { db } from '../db';
import { AppError } from '../middleware/errors';
import { assertCanParticipate, contestStatus, getContest, present } from '../services/contests';
import { QuestionRow, scoreSubmission } from '../services/scoring';

export async function join(req: Request, res: Response) {
  const contest = await getContest(req.params.id);
  assertCanParticipate(req.user, contest);
  const status = contestStatus(contest);
  if (status !== 'active') {
    throw new AppError(409, 'CONTEST_NOT_ACTIVE', `Contest is ${status}`);
  }
  // unique (contest_id, user_id) makes this safe under concurrent requests
  const [created] = await db('participations')
    .insert({ contest_id: contest.id, user_id: req.user!.id })
    .onConflict(['contest_id', 'user_id'])
    .ignore()
    .returning('*');
  if (created) {
    req.log.info({ contestId: contest.id, userId: req.user!.id }, 'contest joined');
    res.status(201).json(created);
    return;
  }
  const existing = await db('participations').where({ contest_id: contest.id, user_id: req.user!.id }).first();
  res.json(existing);
}

export async function submit(req: Request, res: Response) {
  const result = await db.transaction(async (trx) => {
    const contest = await getContest(req.params.id, trx);
    const status = contestStatus(contest);
    if (status !== 'active') {
      throw new AppError(409, 'CONTEST_NOT_ACTIVE', `Contest is ${status}, submissions are closed`);
    }
    // row lock: two submits for the same participation queue up here and the
    // second one sees submitted_at already set
    const participation = await trx('participations')
      .where({ contest_id: contest.id, user_id: req.user!.id })
      .forUpdate()
      .first();
    if (!participation) {
      throw new AppError(409, 'NOT_JOINED', 'Join the contest before submitting');
    }
    if (participation.submitted_at) {
      throw new AppError(409, 'ALREADY_SUBMITTED', 'Answers were already submitted for this contest');
    }
    const questions = await trx<QuestionRow>('questions').where({ contest_id: contest.id }).orderBy('position');
    if (!questions.length) {
      throw new AppError(409, 'NO_QUESTIONS', 'This contest has no questions yet');
    }
    const scored = scoreSubmission(questions, req.body.answers);
    await trx('answers').insert(
      scored.results.map((r) => ({
        participation_id: participation.id,
        question_id: r.questionId,
        selected: JSON.stringify(r.selected),
        is_correct: r.isCorrect,
      })),
    );
    const [updated] = await trx('participations')
      .where({ id: participation.id })
      .update({ submitted_at: trx.fn.now(), score: scored.score })
      .returning('*');
    return { contest, participation: updated, scored };
  });

  // rank right now: everyone with a better score, or the same score submitted earlier
  const [{ rank }] = await db('participations')
    .where({ contest_id: result.contest.id })
    .whereNotNull('submitted_at')
    .where((b) =>
      b
        .where('score', '>', result.participation.score)
        .orWhere((c) =>
          c.where('score', result.participation.score).andWhere('submitted_at', '<', result.participation.submitted_at),
        ),
    )
    .count<{ rank: string }[]>('* as rank');

  req.log.info(
    {
      contestId: result.contest.id,
      userId: req.user!.id,
      score: result.scored.score,
      maxScore: result.scored.maxScore,
    },
    'answers submitted',
  );
  res.json({
    score: result.scored.score,
    maxScore: result.scored.maxScore,
    correctCount: result.scored.correctCount,
    totalQuestions: result.scored.results.length,
    rank: Number(rank) + 1,
    submittedAt: result.participation.submitted_at,
  });
}

export async function result(req: Request, res: Response) {
  const contest = await getContest(req.params.id);
  const participation = await db('participations').where({ contest_id: contest.id, user_id: req.user!.id }).first();
  if (!participation) {
    throw new AppError(404, 'NOT_JOINED', 'You have not joined this contest');
  }
  if (!participation.submitted_at) {
    res.json({ contest: present(contest, req.user), participation, answers: [] });
    return;
  }
  const answers = await db('answers')
    .join('questions', 'questions.id', 'answers.question_id')
    .where('answers.participation_id', participation.id)
    .orderBy('questions.position')
    .select(
      'questions.id as question_id',
      'questions.text',
      'questions.type',
      'questions.options',
      'questions.correct_answers',
      'questions.explanation',
      'questions.points',
      'answers.selected',
      'answers.is_correct',
    );
  res.json({ contest: present(contest, req.user), participation, answers });
}
