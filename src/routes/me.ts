import { Router } from 'express';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { contestStatus } from '../services/contests';
import { pageSchema } from './shared';

export const meRouter = Router();
meRouter.use(requireAuth);

const contestCols = ['contests.id as contest_id', 'contests.name', 'contests.access_level', 'contests.prize', 'contests.start_time', 'contests.end_time', 'contests.finalized_at', 'contests.winner_user_id'];

// contests the user has finished, newest first, with their rank and whether they won
meRouter.get('/history', validate(pageSchema, 'query'), async (req, res, next) => {
  try {
    const { page, pageSize } = res.locals.query;
    const base = db('participations')
      .join('contests', 'contests.id', 'participations.contest_id')
      .where('participations.user_id', req.user!.id)
      .whereNotNull('participations.submitted_at');
    const [{ total }] = await base.clone().count<{ total: string }[]>('* as total');
    const rows = await base
      .clone()
      .select(...contestCols, 'participations.score', 'participations.joined_at', 'participations.submitted_at')
      .select(
        db.raw(
          `(select count(*) + 1 from participations p2
            where p2.contest_id = participations.contest_id and p2.submitted_at is not null
              and (p2.score > participations.score
                   or (p2.score = participations.score and p2.submitted_at < participations.submitted_at))) as rank`,
        ),
      )
      .select(db.raw('(select count(*) from questions q where q.contest_id = contests.id) as question_count'))
      .orderBy('participations.submitted_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    res.json({
      items: rows.map((r) => ({
        ...r,
        rank: Number(r.rank),
        question_count: Number(r.question_count),
        status: contestStatus(r),
        won: r.finalized_at !== null && r.winner_user_id === req.user!.id,
      })),
      total: Number(total),
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});

// joined but not submitted. "missed" means the contest ended before they answered.
meRouter.get('/in-progress', async (req, res, next) => {
  try {
    const rows = await db('participations')
      .join('contests', 'contests.id', 'participations.contest_id')
      .where('participations.user_id', req.user!.id)
      .whereNull('participations.submitted_at')
      .select(...contestCols, 'participations.joined_at')
      .select(db.raw('(select count(*) from questions q where q.contest_id = contests.id) as question_count'))
      .orderBy('contests.end_time', 'asc');
    res.json({
      items: rows.map((r) => {
        const status = contestStatus(r);
        return { ...r, question_count: Number(r.question_count), status, missed: status === 'ended' };
      }),
    });
  } catch (err) {
    next(err);
  }
});

meRouter.get('/prizes', async (req, res, next) => {
  try {
    const rows = await db('prizes')
      .join('contests', 'contests.id', 'prizes.contest_id')
      .where('prizes.user_id', req.user!.id)
      .select('prizes.id', 'prizes.prize', 'prizes.awarded_at', 'contests.id as contest_id', 'contests.name as contest_name')
      .orderBy('prizes.awarded_at', 'desc');
    res.json({ items: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
});
