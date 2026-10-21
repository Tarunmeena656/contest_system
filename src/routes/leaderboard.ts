import { Router } from 'express';
import * as leaderboard from '../controllers/leaderboard';
import { wrap } from '../middleware/asyncHandler';
import { optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { pageSchema } from '../schemas/common';

export const leaderboardRouter = Router();

leaderboardRouter.get('/', optionalAuth, validate(pageSchema, 'query'), wrap(leaderboard.overall));
