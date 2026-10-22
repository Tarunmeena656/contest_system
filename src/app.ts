import { randomUUID } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './logger';
import { errorHandler, notFound } from './middleware/errors';
import { generalLimiter } from './middleware/rateLimit';
import { api } from './routes';

export const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
    customLogLevel: (req, res, err) =>
      err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url }) },
  }),
);
app.use(express.json({ limit: '200kb' }));
app.use(generalLimiter);

app.use('/api', api);

// production: the built frontend is served from here and any non-api path gets index.html
if (config.staticDir) {
  app.use(express.static(config.staticDir));
  app.get(/^(?!\/api(\/|$)).*/, (req, res) => {
    res.sendFile(path.join(config.staticDir, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);
