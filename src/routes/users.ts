import { Router } from 'express';
import * as users from '../controllers/users';
import { wrap } from '../middleware/asyncHandler';
import { requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { roleBody } from '../schemas/auth';
import { idParam } from '../schemas/common';

export const usersRouter = Router();

usersRouter.patch(
  '/:id/role',
  requireRole('admin'),
  validate(idParam, 'params'),
  validate(roleBody),
  wrap(users.changeRole),
);
