import { db } from '../db';
import { logger } from '../logger';
import { ContestRow } from './contests';

const log = logger.child({ module: 'finalizer' });

// Closes a contest and awards its prize to the top of the leaderboard. Safe to
// call from several workers at once: the UPDATE only wins for whoever flips
// finalized_at first, everyone else gets 0 rows and backs off.
export async function finalizeContest(contestId: string) {
  return db.transaction(async (trx) => {
    const [contest] = await trx<ContestRow>('contests')
      .where({ id: contestId })
      .whereNull('finalized_at')
      .where('end_time', '<=', trx.fn.now())
      .update({ finalized_at: trx.fn.now(), updated_at: trx.fn.now() })
      .returning('*');
    if (!contest) {
      return null;
    }

    const winner = await trx('participations')
      .where({ contest_id: contestId })
      .whereNotNull('submitted_at')
      .orderBy([
        { column: 'score', order: 'desc' },
        { column: 'submitted_at', order: 'asc' },
      ])
      .first();

    if (winner) {
      await trx('contests').where({ id: contestId }).update({ winner_user_id: winner.user_id });
      if (contest.prize) {
        await trx('prizes').insert({ contest_id: contestId, user_id: winner.user_id, prize: contest.prize });
      }
    }
    log.info(
      { contestId, winnerUserId: winner?.user_id ?? null, prize: contest.prize, score: winner?.score ?? null },
      'contest finalized',
    );
    return { contestId, winnerUserId: winner?.user_id ?? null, prize: winner ? contest.prize : null };
  });
}

export async function finalizeDueContests() {
  // one worker at a time across all instances; the lock is released when the tx ends
  const due = await db.transaction(async (trx) => {
    const [{ locked }] = (await trx.raw(`select pg_try_advisory_xact_lock(hashtext('contest-finalizer')) as locked`))
      .rows;
    if (!locked) {
      return [];
    }
    const rows = await trx('contests').select('id').whereNull('finalized_at').where('end_time', '<=', trx.fn.now());
    const results = [];
    for (const row of rows) {
      results.push(await finalizeContest(row.id));
    }
    return results;
  });
  return due.filter(Boolean);
}

export function startFinalizer(intervalMs: number) {
  if (intervalMs <= 0) {
    return () => {};
  }
  const tick = () =>
    finalizeDueContests().catch((err) => {
      log.error({ err }, 'finalizer run failed');
    });
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  log.info({ intervalMs }, 'finalizer started');
  return () => clearInterval(timer);
}
