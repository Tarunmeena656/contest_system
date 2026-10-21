import { Request, Response } from 'express';
import { db } from '../db';
import { AppError } from '../middleware/errors';
import { ContestRow, contestStatus, getContest, listContests, present } from '../services/contests';
import { finalizeContest } from '../services/finalize';

export async function list(req: Request, res: Response) {
  const { page, pageSize, tag, ...filters } = res.locals.query;
  res.json(await listContests({ ...filters, tags: tag ? [tag] : undefined }, page, pageSize, req.user));
}

export async function create(req: Request, res: Response) {
  const [contest] = await db<ContestRow>('contests')
    .insert({ ...req.body, created_by: req.user!.id })
    .returning('*');
  req.log.info({ contestId: contest.id, by: req.user!.id }, 'contest created');
  res.status(201).json(present(contest, req.user));
}

export async function getOne(req: Request, res: Response) {
  const contest = await getContest(req.params.id);
  const [{ question_count }] = await db('questions').where({ contest_id: contest.id }).count('* as question_count');
  const [{ participant_count }] = await db('participations')
    .where({ contest_id: contest.id })
    .count('* as participant_count');
  const participation = req.user
    ? await db('participations').where({ contest_id: contest.id, user_id: req.user.id }).first()
    : null;
  res.json({
    ...present(contest, req.user),
    question_count: Number(question_count),
    participant_count: Number(participant_count),
    my_participation: participation ?? null,
  });
}

export async function update(req: Request, res: Response) {
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
}

export async function remove(req: Request, res: Response) {
  const deleted = await db('contests').where({ id: req.params.id }).delete();
  if (!deleted) {
    throw new AppError(404, 'CONTEST_NOT_FOUND', 'Contest not found');
  }
  req.log.info({ contestId: req.params.id, by: req.user!.id }, 'contest deleted');
  res.status(204).end();
}

// manual trigger for what the background worker does on its own
export async function finalize(req: Request, res: Response) {
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
}
