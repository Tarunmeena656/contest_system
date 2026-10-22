import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Badge } from '../components/Badge';
import { ContestCard } from '../components/ContestCard';
import { ErrorMessage, Loading, Message } from '../components/Message';
import { useLoad } from '../hooks/useLoad';
import type { Contest, Page, SearchResult } from '../types';

const examples = [
  'Show me active VIP contests',
  'Find beginner contests about JavaScript',
  'I want a difficult JavaScript contest starting this week',
  'Show me contests related to backend development with prizes',
  'Find normal contests that are currently active',
];

const emptyFilters = { status: '', access: '', difficulty: '', tag: '', q: '' };

export function ContestsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(emptyFilters);
  const [sentence, setSentence] = useState('');
  const [search, setSearch] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<unknown>(null);

  const params = new URLSearchParams({ pageSize: '50' });
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const query = params.toString();

  // can_participate depends on who is asking, so reload when the user changes
  const list = useLoad(() => api.get<Page<Contest>>(`/contests?${query}`), [query, user?.id]);

  const update = (field: keyof typeof filters, value: string) => {
    setSearch(null);
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    if (!sentence.trim()) {
      setSearch(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      setSearch(await api.get<SearchResult>(`/contests/search?q=${encodeURIComponent(sentence)}&pageSize=50`));
    } catch (err) {
      setSearchError(err);
    } finally {
      setSearching(false);
    }
  }

  const contests = search ? search.items : (list.data?.items ?? []);
  const understood = search
    ? Object.entries(search.filters).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0))
    : [];

  return (
    <div className="stack">
      <section className="card">
        <h2>Find a contest</h2>
        <form onSubmit={runSearch} className="search-row">
          <input
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="Describe what you want, e.g. active VIP contests about Node.js with prizes"
            aria-label="Natural-language search"
          />
          <button type="submit" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
          {search && (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSearch(null);
                setSentence('');
              }}
            >
              Clear
            </button>
          )}
        </form>
        <div className="examples">
          <span className="muted small">Try:</span>
          {examples.map((example) => (
            <button key={example} type="button" className="chip" onClick={() => setSentence(example)}>
              {example}
            </button>
          ))}
        </div>
        <ErrorMessage error={searchError} />
        {search && (
          <p className="muted small">
            Understood as:{' '}
            {understood.length === 0
              ? 'no filters, showing everything'
              : understood.map(([key, value]) => (
                  <Badge key={key} tone="blue">
                    {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
                  </Badge>
                ))}
            {search.cached && ' · served from cache'}
            {search.relaxed && ' · no tag matched the topics, so name and description were searched instead'}
          </p>
        )}
      </section>

      {!search && (
        <div className="filters">
          <select value={filters.status} onChange={(e) => update('status', e.target.value)} aria-label="Status">
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="ended">Ended</option>
          </select>
          <select value={filters.access} onChange={(e) => update('access', e.target.value)} aria-label="Access">
            <option value="">Any access</option>
            <option value="normal">Normal</option>
            <option value="vip">VIP</option>
          </select>
          <select
            value={filters.difficulty}
            onChange={(e) => update('difficulty', e.target.value)}
            aria-label="Difficulty"
          >
            <option value="">Any difficulty</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <input
            value={filters.tag}
            onChange={(e) => update('tag', e.target.value)}
            placeholder="Tag"
            aria-label="Tag"
          />
          <input
            value={filters.q}
            onChange={(e) => update('q', e.target.value)}
            placeholder="Search name or description"
            aria-label="Text search"
          />
        </div>
      )}

      {!user && <Message>Browse freely. Sign in to join a contest and answer questions.</Message>}
      {list.loading && !search && <Loading what="Loading contests" />}
      <ErrorMessage error={list.error} />
      {contests.length === 0 && !list.loading && <p className="muted">No contests match.</p>}
      <div className="grid">
        {contests.map((contest) => (
          <ContestCard key={contest.id} contest={contest} />
        ))}
      </div>
    </div>
  );
}
