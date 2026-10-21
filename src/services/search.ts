import { getAi } from '../ai';
import { SearchFilters } from '../ai/types';
import { AuthUser } from '../middleware/auth';
import { ContestFilters, listContests } from './contests';

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { filters: SearchFilters; expires: number }>();

function normalise(q: string) {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

// The model only interprets the sentence; the database does the actual search.
// Interpretations are cached so repeated or popular queries cost nothing.
export async function interpretQuery(q: string): Promise<{ filters: SearchFilters; cached: boolean }> {
  const key = normalise(q);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    return { filters: hit.filters, cached: true };
  }
  const filters = await getAi().parseSearch(q);
  if (cache.size >= CACHE_MAX) {
    cache.delete(cache.keys().next().value!);
  }
  cache.set(key, { filters, expires: Date.now() + CACHE_TTL_MS });
  return { filters, cached: false };
}

export function toContestFilters(f: SearchFilters): ContestFilters {
  return {
    status: f.status ?? undefined,
    access: f.accessLevel ?? undefined,
    difficulty: f.difficulty ?? undefined,
    tags: f.topics.length ? f.topics : undefined,
    hasPrize: f.hasPrize ?? undefined,
    startsWithinDays: f.startsWithinDays ?? undefined,
  };
}

export async function searchContests(q: string, page: number, pageSize: number, user?: AuthUser) {
  const { filters, cached } = await interpretQuery(q);
  const dbFilters = toContestFilters(filters);
  let result = await listContests(dbFilters, page, pageSize, user);
  let relaxed = false;
  // topics are matched against tags first; if that finds nothing, fall back to
  // full-text search on name/description so "node" still finds "Node.js Backend"
  if (result.total === 0 && dbFilters.tags) {
    const { tags, ...rest } = dbFilters;
    result = await listContests({ ...rest, q: tags.join(' ') }, page, pageSize, user);
    relaxed = true;
  }
  return { query: q, filters, cached, relaxed, ...result };
}

export function clearSearchCache() {
  cache.clear();
}
