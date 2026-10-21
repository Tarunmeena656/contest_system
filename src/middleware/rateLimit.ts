import { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { config } from '../config';

// Per-process in-memory store. Good enough for one instance; swap in a Redis
// store (rate-limit-redis) when running several replicas behind a load balancer.
const byUserOrIp = (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? '');

const handler = (req: Request, res: import('express').Response) => {
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' } });
};

const common = { standardHeaders: 'draft-8' as const, legacyHeaders: false, handler };

export const generalLimiter = rateLimit({
  ...common,
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  keyGenerator: byUserOrIp,
});

export const authLimiter = rateLimit({
  ...common,
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.authMax,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
});

// AI calls cost real money, so this one is tight and per user.
export const aiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: config.rateLimit.aiMax,
  keyGenerator: byUserOrIp,
});
