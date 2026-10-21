import { Router } from 'express';
import { generateParamsSchema } from '../ai/types';
import * as contests from '../controllers/contests';
import * as leaderboard from '../controllers/leaderboard';
import * as participation from '../controllers/participation';
import * as questions from '../controllers/questions';
import { wrap } from '../middleware/asyncHandler';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { idParam, pageSchema } from '../schemas/common';
import { contestBody, contestPatch, listQuery } from '../schemas/contest';
import { submitBody } from '../schemas/participation';
import { questionsBody } from '../schemas/question';

export const contestsRouter = Router();

const admin = requireRole('admin');
const byId = validate(idParam, 'params');

// contests
contestsRouter.get('/', optionalAuth, validate(listQuery, 'query'), wrap(contests.list));
contestsRouter.post('/', admin, validate(contestBody), wrap(contests.create));
contestsRouter.get('/:id', optionalAuth, byId, wrap(contests.getOne));
contestsRouter.patch('/:id', admin, byId, validate(contestPatch), wrap(contests.update));
contestsRouter.delete('/:id', admin, byId, wrap(contests.remove));
contestsRouter.post('/:id/finalize', admin, byId, wrap(contests.finalize));

// questions
contestsRouter.post('/:id/questions', admin, byId, validate(questionsBody), wrap(questions.add));
contestsRouter.get('/:id/questions', requireAuth, byId, wrap(questions.list));
contestsRouter.post(
  '/:id/questions/generate',
  admin,
  aiLimiter,
  byId,
  validate(generateParamsSchema),
  wrap(questions.generate),
);

// participation
contestsRouter.post('/:id/join', requireAuth, byId, wrap(participation.join));
contestsRouter.post('/:id/submit', requireAuth, byId, validate(submitBody), wrap(participation.submit));
contestsRouter.get('/:id/result', requireAuth, byId, wrap(participation.result));
contestsRouter.get('/:id/leaderboard', optionalAuth, byId, validate(pageSchema, 'query'), wrap(leaderboard.forContest));
