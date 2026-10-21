import { NextFunction, Request, RequestHandler, Response } from 'express';

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;

// express 4 does not forward a rejected promise to the error handler, so every
// controller goes through this instead of repeating try/catch/next.
export function wrap(fn: Handler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
