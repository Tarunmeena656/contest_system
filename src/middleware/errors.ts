import { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (req: Request, res: Response) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
};

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      req.log.error({ err, code: err.code }, err.message);
    }
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  const pg = err as { code?: string; constraint?: string };
  if (pg.code === '23505') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource already exists', details: pg.constraint } });
    return;
  }
  if (pg.code === '22P02') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed id or value' } });
    return;
  }
  req.log.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong', requestId: req.id } });
}
