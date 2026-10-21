import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimit';
import { authRouter } from './auth';
import { contestsRouter } from './contests';
import { leaderboardRouter } from './leaderboard';
import { meRouter } from './me';
import { searchRouter } from './search';
import { usersRouter } from './users';

export const api = Router();

api.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
api.use('/auth', authLimiter, authRouter);
api.use('/users', usersRouter);
// before /contests, otherwise "search" would be read as a contest id
api.use('/contests/search', searchRouter);
api.use('/contests', contestsRouter);
api.use('/leaderboard', leaderboardRouter);
api.use('/me', meRouter);
