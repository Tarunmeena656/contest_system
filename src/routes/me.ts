import { Router } from 'express';
import * as me from '../controllers/me';
import { wrap } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { pageSchema } from '../schemas/common';

export const meRouter = Router();

meRouter.use(requireAuth);
meRouter.get('/history', validate(pageSchema, 'query'), wrap(me.history));
meRouter.get('/in-progress', wrap(me.inProgress));
meRouter.get('/prizes', wrap(me.prizes));
