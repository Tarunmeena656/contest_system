import { Knex } from 'knex';
import { db } from '../db';
import { AppError } from '../middleware/errors';
import { AuthUser } from '../middleware/auth';

export type ContestStatus = 'upcoming' | 'active' | 'ended';

export interface ContestRow {
  id: string;
  name: string;
  description: string;
  access_level: 'normal' | 'vip';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  prize: string | null;
  start_time: Date;
  end_time: Date;
  created_by: string | null;
  finalized_at: Date | null;
  winner_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export function contestStatus(c: Pick<ContestRow, 'start_time' | 'end_time'>, now = new Date()): ContestStatus {
  if (now < c.start_time) return 'upcoming';
  if (now >= c.end_time) return 'ended';
  return 'active';
}

export function canParticipate(user: AuthUser | undefined, c: Pick<ContestRow, 'access_level'>): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'vip') return true;
  return c.access_level === 'normal';
}

export function assertCanParticipate(user: AuthUser | undefined, c: Pick<ContestRow, 'access_level'>) {
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign up and log in to participate');
  }
  if (!canParticipate(user, c)) {
    throw new AppError(403, 'VIP_ONLY', 'This contest is only open to VIP users');
  }
}

// what the api returns for a contest, on top of the raw row
export function present(c: ContestRow, user?: AuthUser) {
  const { search_vector, ...rest } = c as ContestRow & { search_vector?: unknown };
  return { ...rest, status: contestStatus(c), can_participate: canParticipate(user, c) };
}

export async function getContest(id: string, trx: Knex = db): Promise<ContestRow> {
  const contest = await trx<ContestRow>('contests').where({ id }).first();
  if (!contest) {
    throw new AppError(404, 'CONTEST_NOT_FOUND', 'Contest not found');
  }
  return contest;
}

export interface ContestFilters {
  status?: ContestStatus;
  access?: 'normal' | 'vip';
  difficulty?: ContestRow['difficulty'];
  tags?: string[];
  q?: string;
  hasPrize?: boolean;
  startsWithinDays?: number;
}

export function applyFilters(query: Knex.QueryBuilder, f: ContestFilters, now = new Date()) {
  if (f.status === 'active') query.where('start_time', '<=', now).andWhere('end_time', '>', now);
  if (f.status === 'upcoming') query.where('start_time', '>', now);
  if (f.status === 'ended') query.where('end_time', '<=', now);
  if (f.access) query.where('access_level', f.access);
  if (f.difficulty) query.where('difficulty', f.difficulty);
  if (f.hasPrize === true) query.whereNotNull('prize');
  if (f.hasPrize === false) query.whereNull('prize');
  if (f.startsWithinDays) {
    const until = new Date(now.getTime() + f.startsWithinDays * 86_400_000);
    query.where('start_time', '>=', now).andWhere('start_time', '<=', until);
  }
  if (f.tags?.length) {
    // case-insensitive overlap: any of the wanted tags present on the contest
    query.whereRaw('exists (select 1 from unnest(tags) t where lower(t) = any(?))', [
      f.tags.map((t) => t.toLowerCase()),
    ]);
  }
  if (f.q) {
    query.whereRaw(`search_vector @@ plainto_tsquery('english', ?)`, [f.q]);
  }
  return query;
}

export async function listContests(f: ContestFilters, page: number, pageSize: number, user?: AuthUser) {
  const base = applyFilters(db('contests'), f);
  const [{ count }] = await base.clone().count<{ count: string }[]>('* as count');
  const rows = await base
    .clone()
    .select('contests.*')
    .orderBy('start_time', 'asc')
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { items: rows.map((c: ContestRow) => present(c, user)), total: Number(count), page, pageSize };
}
