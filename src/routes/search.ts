import { Router } from 'express';
import * as search from '../controllers/search';
import { wrap } from '../middleware/asyncHandler';
import { optionalAuth } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import { searchQuery } from '../schemas/search';

export const searchRouter = Router();

searchRouter.get('/', optionalAuth, aiLimiter, validate(searchQuery, 'query'), wrap(search.search));
