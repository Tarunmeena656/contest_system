import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from './errors';

export type Role = 'user' | 'vip' | 'admin';

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
}

// Guests are allowed through without a user; a bad token is still an error so
// clients notice expired sessions instead of silently becoming guests.
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) {
    next();
    return;
  }
  if (!header.startsWith('Bearer ')) {
    next(new AppError(401, 'INVALID_TOKEN', 'Authorization header must be "Bearer <token>"'));
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as jwt.JwtPayload;
    req.user = { id: payload.sub as string, role: payload.role as Role };
    next();
  } catch {
    next(new AppError(401, 'INVALID_TOKEN', 'Token is invalid or expired'));
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  optionalAuth(req, res, (err?: unknown) => {
    if (err) {
      next(err);
    } else if (!req.user) {
      next(new AppError(401, 'UNAUTHENTICATED', 'Sign in to do this'));
    } else {
      next();
    }
  });
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, (err?: unknown) => {
      if (err) {
        next(err);
      } else if (!roles.includes(req.user!.role)) {
        next(new AppError(403, 'FORBIDDEN', `Requires role: ${roles.join(' or ')}`));
      } else {
        next();
      }
    });
  };
}
