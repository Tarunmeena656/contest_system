import { randomUUID } from 'node:crypto';
import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './logger';
import { errorHandler, notFound } from './middleware/errors';
import { generalLimiter, authLimiter } from './middleware/rateLimit';
import { authRouter, usersRouter } from './routes/auth';
import { contestsRouter } from './routes/contests';
import { leaderboardRouter } from './routes/leaderboard';
import { meRouter } from './routes/me';
import { searchRouter } from './routes/search';

export const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
    customLogLevel: (req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url }) },
  }),
);
app.use(express.json({ limit: '200kb' }));
app.use(generalLimiter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/users', usersRouter);
app.use('/api/contests/search', searchRouter);
app.use('/api/contests', contestsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/me', meRouter);

app.use(notFound);
app.use(errorHandler);
