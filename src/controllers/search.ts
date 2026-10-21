import { Request, Response } from 'express';
import { searchContests } from '../services/search';

export async function search(req: Request, res: Response) {
  const { q, page, pageSize } = res.locals.query;
  const result = await searchContests(q, page, pageSize, req.user);
  req.log.info({ q, filters: result.filters, cached: result.cached, total: result.total }, 'nl search');
  res.json(result);
}
