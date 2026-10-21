import { Request, Response } from 'express';
import { db } from '../db';
import { contestStatus, getContest } from '../services/contests';

export async function forContest(req: Request, res: Response) {
  const contest = await getContest(req.params.id);
  const { page, pageSize } = res.locals.query;
  const ranked = db('participations')
    .join('users', 'users.id', 'participations.user_id')
    .where({ contest_id: contest.id })
    .whereNotNull('submitted_at')
    .select('participations.user_id', 'users.name', 'participations.score', 'participations.submitted_at')
    .select(db.raw('rank() over (order by score desc, submitted_at asc) as rank'));
  const rows = await db
    .from(ranked.as('r'))
    .orderBy('rank')
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db('participations')
    .where({ contest_id: contest.id })
    .whereNotNull('submitted_at')
    .count<{ total: string }[]>('* as total');
  const me = req.user ? await db.from(ranked.clone().as('r')).where('user_id', req.user.id).first() : null;
  res.json({
    contest: {
      id: contest.id,
      name: contest.name,
      status: contestStatus(contest),
      prize: contest.prize,
      finalized_at: contest.finalized_at,
      winner_user_id: contest.winner_user_id,
    },
    items: rows.map((r) => ({ ...r, rank: Number(r.rank) })),
    me: me ? { ...me, rank: Number(me.rank) } : null,
    total: Number(total),
    page,
    pageSize,
  });
}

// overall standings: total score across every contest a user has finished
export async function overall(req: Request, res: Response) {
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
  // ties share a rank, but the row order is still fixed so pages never shuffle
  const rows = await db
    .from(totals.as('t'))
    .orderBy([{ column: 'rank' }, { column: 'prizes_won', order: 'desc' }, { column: 'name' }])
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [{ total }] = await db.from(totals.clone().as('t')).count<{ total: string }[]>('* as total');
  const me = req.user ? await db.from(totals.clone().as('t')).where('user_id', req.user.id).first() : null;
  res.json({
    items: rows.map((r) => ({ ...r, rank: Number(r.rank) })),
    me: me ? { ...me, rank: Number(me.rank) } : null,
    total: Number(total),
    page,
    pageSize,
  });
}
