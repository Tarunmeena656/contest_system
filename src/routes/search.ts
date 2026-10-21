import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { searchContests } from '../services/search';
import { pageSchema } from './shared';

const searchQuery = pageSchema.extend({ q: z.string().trim().min(2).max(300) });

export const searchRouter = Router();

searchRouter.get('/', optionalAuth, aiLimiter, validate(searchQuery, 'query'), async (req, res, next) => {
  try {
    const { q, page, pageSize } = res.locals.query;
    const result = await searchContests(q, page, pageSize, req.user);
    req.log.info({ q, filters: result.filters, cached: result.cached, total: result.total }, 'nl search');
    res.json(result);
  } catch (err) {
    next(err);
  }
});
