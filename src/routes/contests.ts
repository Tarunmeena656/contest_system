import { Router } from 'express';
import { z } from 'zod';
import { getAi } from '../ai';
import { generateParamsSchema, generatedQuestionSchema, normaliseDifficulty, questionTypes } from '../ai/types';
import { db } from '../db';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { aiLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import {
  ContestRow,
  assertCanParticipate,
  canParticipate,
  contestStatus,
  getContest,
  listContests,
  present,
} from '../services/contests';
import { finalizeContest } from '../services/finalize';
import { QuestionRow, scoreSubmission } from '../services/scoring';
import { pageSchema } from './shared';

const contestFields = {
  name: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000),
  access_level: z.enum(['normal', 'vip']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(10),
  prize: z.string().trim().max(300).nullable(),
  start_time: z.coerce.date(),
  end_time: z.coerce.date(),
};

const contestBody = z
  .object({
    ...contestFields,
    description: contestFields.description.default(''),
    access_level: contestFields.access_level.default('normal'),
    difficulty: contestFields.difficulty.default('intermediate'),
    tags: contestFields.tags.default([]),
    prize: contestFields.prize.default(null),
  })
  .refine((c) => c.end_time > c.start_time, { message: 'end_time must be after start_time', path: ['end_time'] });

// no defaults here on purpose: a PATCH must only touch the fields it names.
// the start/end check happens against the merged row in the handler.
const contestPatch = z.object(contestFields).partial();

const listQuery = pageSchema.extend({
  status: z.enum(['upcoming', 'active', 'ended']).optional(),
  access: z.enum(['normal', 'vip']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  tag: z.string().trim().toLowerCase().optional(),
  q: z.string().trim().max(200).optional(),
});

const questionBody = z
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
      ctx.addIssue({ code: 'custom', message: 'every correct answer must be one of the options', path: ['correct_answers'] });
    }
    if (q.type === 'true-false' && (q.options.length !== 2 || q.options.join() !== 'True,False')) {
      ctx.addIssue({ code: 'custom', message: 'true-false options must be exactly ["True", "False"]', path: ['options'] });
    }
    if (q.type !== 'multi-select' && q.correct_answers.length !== 1) {
      ctx.addIssue({ code: 'custom', message: `${q.type} needs exactly one correct answer`, path: ['correct_answers'] });
    }
  });

const questionsBody = z.object({ questions: z.array(questionBody).min(1).max(50) });

const submitBody = z.object({
  answers: z
    .array(z.object({ questionId: z.string().uuid(), selected: z.array(z.string()).max(6) }))
    .max(200),
});

const idParam = z.object({ id: z.string().uuid() });

export const contestsRouter = Router();

contestsRouter.get('/', optionalAuth, validate(listQuery, 'query'), async (req, res, next) => {
  try {
    const { page, pageSize, tag, ...filters } = res.locals.query;
    res.json(await listContests({ ...filters, tags: tag ? [tag] : undefined }, page, pageSize, req.user));
  } catch (err) {
    next(err);
  }
});

contestsRouter.post('/', requireRole('admin'), validate(contestBody), async (req, res, next) => {
  try {
    const [contest] = await db<ContestRow>('contests')
      .insert({ ...req.body, created_by: req.user!.id })
      .returning('*');
    req.log.info({ contestId: contest.id, by: req.user!.id }, 'contest created');
    res.status(201).json(present(contest, req.user));
  } catch (err) {
    next(err);
  }
});

contestsRouter.get('/:id', optionalAuth, validate(idParam, 'params'), async (req, res, next) => {
  try {
    const contest = await getContest(req.params.id);
    const [{ question_count }] = await db('questions').where({ contest_id: contest.id }).count('* as question_count');
    const [{ participant_count }] = await db('participations').where({ contest_id: contest.id }).count('* as participant_count');
    const participation = req.user
      ? await db('participations').where({ contest_id: contest.id, user_id: req.user.id }).first()
      : null;
    res.json({
      ...present(contest, req.user),
      question_count: Number(question_count),
      participant_count: Number(participant_count),
      my_participation: participation ?? null,
    });
  } catch (err) {
    next(err);
  }
});

contestsRouter.patch('/:id', requireRole('admin'), validate(idParam, 'params'), validate(contestPatch), async (req, res, next) => {
  try {
    const current = await getContest(req.params.id);
    const merged = { ...current, ...req.body };
    if (merged.end_time <= merged.start_time) {
      throw new AppError(400, 'VALIDATION_ERROR', 'end_time must be after start_time');
    }
    const [contest] = await db<ContestRow>('contests')
      .where({ id: current.id })
      .update({ ...req.body, updated_at: db.fn.now() })
      .returning('*');
    req.log.info({ contestId: contest.id, by: req.user!.id, fields: Object.keys(req.body) }, 'contest updated');
    res.json(present(contest, req.user));
  } catch (err) {
    next(err);
  }
});

contestsRouter.delete('/:id', requireRole('admin'), validate(idParam, 'params'), async (req, res, next) => {
  try {
    const deleted = await db('contests').where({ id: req.params.id }).delete();
    if (!deleted) {
      throw new AppError(404, 'CONTEST_NOT_FOUND', 'Contest not found');
    }
    req.log.info({ contestId: req.params.id, by: req.user!.id }, 'contest deleted');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---- questions ------------------------------------------------------------

async function insertQuestions(contestId: string, questions: z.infer<typeof questionBody>[]) {
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

contestsRouter.post('/:id/questions', requireRole('admin'), validate(idParam, 'params'), validate(questionsBody), async (req, res, next) => {
  try {
    const contest = await getContest(req.params.id);
    const questions = await insertQuestions(contest.id, req.body.questions);
    req.log.info({ contestId: contest.id, count: questions.length, by: req.user!.id }, 'questions added');
    res.status(201).json({ questions });
  } catch (err) {
    next(err);
  }
});

contestsRouter.get('/:id/questions', requireAuth, validate(idParam, 'params'), async (req, res, next) => {
  try {
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
    res.json({
      questions: questions.map(({ correct_answers, explanation, ...q }) => q),
    });
  } catch (err) {
    next(err);
  }
});

contestsRouter.post(
  '/:id/questions/generate',
  requireRole('admin'),
  aiLimiter,
  validate(idParam, 'params'),
  validate(generateParamsSchema),
  async (req, res, next) => {
    try {
      const contest = await getContest(req.params.id);
      const params = req.body as z.infer<typeof generateParamsSchema>;
      const generated = await getAi().generateQuestions(params);

      // never trust model output blindly: drop anything that is not a well-formed question
      const valid = generated.filter((q) => generatedQuestionSchema.safeParse(q).success && questionBody.safeParse(toQuestion(q)).success);
      const rejected = generated.length - valid.length;
      if (!valid.length) {
        throw new AppError(502, 'AI_BAD_OUTPUT', 'The model produced no usable questions, try again');
      }
      const saved = params.save ? await insertQuestions(contest.id, valid.map(toQuestion)) : [];
      req.log.info(
        { contestId: contest.id, topic: params.topic, requested: params.count, generated: generated.length, rejected, saved: saved.length, provider: getAi().name },
        'questions generated',
      );
      res.status(params.save ? 201 : 200).json({
        provider: getAi().name,
        requested: params.count,
        generated: valid.length,
        rejected,
        saved: params.save,
        questions: params.save
          ? saved
          : valid.map((q) => ({ ...toQuestion(q), difficulty: q.difficulty, topic: q.topic })),
      });
    } catch (err) {
      next(err);
    }
  },
);

function toQuestion(q: z.infer<typeof generatedQuestionSchema>) {
  return {
    type: q.type,
    text: q.question,
    options: q.type === 'true-false' ? ['True', 'False'] : q.options,
    correct_answers: q.type === 'true-false' ? q.correctAnswers.map((a) => (a.toLowerCase() === 'true' ? 'True' : 'False')) : q.correctAnswers,
    explanation: q.explanation || null,
    points: normaliseDifficulty(q.difficulty) === 'advanced' ? 2 : 1,
  };
}

// ---- participation --------------------------------------------------------

contestsRouter.post('/:id/join', requireAuth, validate(idParam, 'params'), async (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

contestsRouter.post('/:id/submit', requireAuth, validate(idParam, 'params'), validate(submitBody), async (req, res, next) => {
  try {
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

    const [{ rank }] = await db('participations')
      .where({ contest_id: result.contest.id })
      .whereNotNull('submitted_at')
      .where((b) =>
        b.where('score', '>', result.participation.score).orWhere((c) =>
          c.where('score', result.participation.score).andWhere('submitted_at', '<', result.participation.submitted_at),
        ),
      )
      .count<{ rank: string }[]>('* as rank');

    req.log.info(
      { contestId: result.contest.id, userId: req.user!.id, score: result.scored.score, maxScore: result.scored.maxScore },
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
  } catch (err) {
    next(err);
  }
});

contestsRouter.get('/:id/result', requireAuth, validate(idParam, 'params'), async (req, res, next) => {
  try {
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
      .select('questions.id as question_id', 'questions.text', 'questions.type', 'questions.options', 'questions.correct_answers', 'questions.explanation', 'questions.points', 'answers.selected', 'answers.is_correct');
    res.json({ contest: present(contest, req.user), participation, answers });
  } catch (err) {
    next(err);
  }
});

contestsRouter.get('/:id/leaderboard', optionalAuth, validate(idParam, 'params'), validate(pageSchema, 'query'), async (req, res, next) => {
  try {
    const contest = await getContest(req.params.id);
    const { page, pageSize } = res.locals.query;
    const ranked = db('participations')
      .join('users', 'users.id', 'participations.user_id')
      .where({ contest_id: contest.id })
      .whereNotNull('submitted_at')
      .select('participations.user_id', 'users.name', 'participations.score', 'participations.submitted_at')
      .select(db.raw('rank() over (order by score desc, submitted_at asc) as rank'));
    const rows = await db.from(ranked.as('r')).orderBy('rank').limit(pageSize).offset((page - 1) * pageSize);
    const [{ total }] = await db('participations').where({ contest_id: contest.id }).whereNotNull('submitted_at').count<{ total: string }[]>('* as total');
    const me = req.user ? await db.from(ranked.clone().as('r')).where('user_id', req.user.id).first() : null;
    res.json({
      contest: { id: contest.id, name: contest.name, status: contestStatus(contest), prize: contest.prize, finalized_at: contest.finalized_at, winner_user_id: contest.winner_user_id },
      items: rows.map((r) => ({ ...r, rank: Number(r.rank) })),
      me: me ? { ...me, rank: Number(me.rank) } : null,
      total: Number(total),
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});

contestsRouter.post('/:id/finalize', requireRole('admin'), validate(idParam, 'params'), async (req, res, next) => {
  try {
    const contest = await getContest(req.params.id);
    if (contest.finalized_at) {
      throw new AppError(409, 'ALREADY_FINALIZED', 'Contest was already finalized');
    }
    if (contestStatus(contest) !== 'ended') {
      throw new AppError(409, 'CONTEST_NOT_ENDED', 'Contest has not ended yet');
    }
    const result = await finalizeContest(contest.id);
    if (!result) {
      throw new AppError(409, 'ALREADY_FINALIZED', 'Contest was finalized by another worker');
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export { canParticipate };
