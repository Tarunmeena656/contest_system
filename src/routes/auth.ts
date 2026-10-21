import { Router } from 'express';
import * as auth from '../controllers/auth';
import { wrap } from '../middleware/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema } from '../schemas/auth';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), wrap(auth.register));
authRouter.post('/login', validate(loginSchema), wrap(auth.login));
authRouter.get('/me', requireAuth, wrap(auth.me));
