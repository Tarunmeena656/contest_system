import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Badge } from '../components/Badge';
import { ContestCard } from '../components/ContestCard';
import { SearchIcon, SparklesIcon } from '../components/Icons';
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

  function clearSearch() {
    setSearch(null);
    setSentence('');
  }

  const contests = search ? search.items : (list.data?.items ?? []);
  const all = list.data?.items ?? [];
  const understood = search
    ? Object.entries(search.filters).filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0))
    : [];
  const filtering = Object.values(filters).some(Boolean);

  return (
    <div className="stack">
      <section className="hero">
        <p className="eyebrow">
          <SparklesIcon /> Programming quiz contests
        </p>
        <h1>Compete, learn, win prizes.</h1>
        <p className="lead">
          Join a running contest, answer single-choice, multiple-choice and true/false questions, and climb the
          leaderboard. Describe what you are looking for in plain words.
        </p>
        <form onSubmit={runSearch} className="hero-search">
          <SearchIcon className="hero-search-icon" />
          <input
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="e.g. active VIP contests about Node.js with prizes"
            aria-label="Natural-language search"
          />
          <button type="submit" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        <div className="examples">
          {examples.map((example) => (
            <button key={example} type="button" className="chip" onClick={() => setSentence(example)}>
              {example}
            </button>
          ))}
        </div>
      </section>

      <ErrorMessage error={searchError} />

      {search && (
        <div className="card understood">
          <div>
            <span className="muted small">Understood as</span>
            <div className="badges">
              {understood.length === 0 ? (
                <span className="muted">no filters, showing everything</span>
              ) : (
                understood.map(([key, value]) => (
                  <Badge key={key} tone="blue">
                    {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
                  </Badge>
                ))
              )}
              {search.cached && <Badge>from cache</Badge>}
              {search.relaxed && <Badge tone="amber">matched on name and description</Badge>}
            </div>
          </div>
          <button type="button" className="secondary" onClick={clearSearch}>
            Clear search
          </button>
        </div>
      )}

      {!search && list.data && !filtering && (
        <div className="stats">
          <Stat value={all.filter((c) => c.status === 'active').length} label="Active now" tone="green" />
          <Stat value={all.filter((c) => c.status === 'upcoming').length} label="Upcoming" tone="amber" />
          <Stat value={all.filter((c) => c.access_level === 'vip').length} label="VIP only" tone="gold" />
          <Stat value={all.filter((c) => c.prize).length} label="With a prize" tone="blue" />
        </div>
      )}

      {!search && (
        <div className="toolbar">
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
          {filtering && (
            <button type="button" className="secondary" onClick={() => setFilters(emptyFilters)}>
              Reset
            </button>
          )}
        </div>
      )}

      <div className="section-head">
        <h2>{search ? `Results for “${search.query}”` : 'Contests'}</h2>
        <span className="muted small">{contests.length} shown</span>
      </div>

      {!user && <Message>Browse freely. Sign in to join a contest and answer questions.</Message>}
      {list.loading && !search && <Loading what="Loading contests" />}
      <ErrorMessage error={list.error} />
      {contests.length === 0 && !list.loading && (
        <div className="empty">
          <p>No contests match.</p>
          {search ? (
            <button type="button" className="secondary" onClick={clearSearch}>
              Show all contests
            </button>
          ) : (
            filtering && (
              <button type="button" className="secondary" onClick={() => setFilters(emptyFilters)}>
                Reset filters
              </button>
            )
          )}
        </div>
      )}
      <div className="grid">
        {contests.map((contest) => (
          <ContestCard key={contest.id} contest={contest} />
        ))}
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className={`stat stat-${tone}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
