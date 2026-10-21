import { Router } from 'express';
import { db } from '../db';
import { optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { pageSchema } from './shared';

export const leaderboardRouter = Router();

// overall standings: total score across every contest a user has finished
leaderboardRouter.get('/', optionalAuth, validate(pageSchema, 'query'), async (req, res, next) => {
  try {
    const { page, pageSize } = res.locals.query;
    const totals = db('participations')
      .join('users', 'users.id', 'participations.user_id')
      .whereNotNull('participations.submitted_at')
      .groupBy('users.id', 'users.name')
      .select('users.id as user_id', 'users.name')
      .select(db.raw('sum(participations.score)::int as total_score'))
      .select(db.raw('count(*)::int as contests_played'))
      .select(db.raw('(select count(*)::int from prizes p where p.user_id = users.id) as prizes_won'))
      .select(db.raw('rank() over (order by sum(participations.score) desc, count(*) asc) as rank'));
    const rows = await db.from(totals.as('t')).orderBy('rank').limit(pageSize).offset((page - 1) * pageSize);
    const [{ total }] = await db.from(totals.clone().as('t')).count<{ total: string }[]>('* as total');
    const me = req.user ? await db.from(totals.clone().as('t')).where('user_id', req.user.id).first() : null;
    res.json({
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
