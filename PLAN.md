# PLAN

How I approached the contest system, what I decided up front, and what changed while building.

## Goals

1. The core loop has to be correct under pressure: join, answer, score, rank, award. Those are the parts that get hit concurrently and where a bug is visible to users (double prizes, lost submissions).
2. AI features should be useful but boring from an engineering point of view: validated input, validated output, cached, rate limited, and replaceable by a mock so the system runs without a key.
3. Keep it small. One service, one database, no queues or caches to install.

## Stack

- **Node.js + TypeScript + Express.** Familiar, fast to iterate, easy to read in a review.
- **PostgreSQL** with **knex** for migrations and queries. I wanted hand-written SQL where it matters (ranking, finalization, full-text search) without giving up a query builder for the CRUD.
- **zod** for request validation and for the shape of AI output.
- **jsonwebtoken + bcryptjs** for auth. Stateless JWTs carry the role; roles are rechecked against the token only, which is fine for a contest system where role changes are rare.
- **pino** for structured JSON logs with a request id on every line.
- **express-rate-limit** for per-IP and per-user limits.
- **vitest + supertest** against a real Postgres database, because most of the interesting behaviour is in SQL and transactions.

## Data model

```
users           id, name, email (unique), password_hash, role (user|vip|admin)
contests        id, name, description, access_level (normal|vip), difficulty, tags text[],
                prize, start_time, end_time, created_by, finalized_at, winner_user_id,
                search_vector (generated tsvector)
questions       id, contest_id, type (single-select|multi-select|true-false), text,
                options jsonb, correct_answers jsonb, explanation, points, position
participations  id, contest_id, user_id, joined_at, submitted_at, score      unique (contest_id, user_id)
answers         id, participation_id, question_id, selected jsonb, is_correct
prizes          id, contest_id (unique), user_id, prize, awarded_at
```

Decisions:

- Contest status is derived from `start_time` / `end_time` at read time instead of being a column. There is nothing to keep in sync and the worker only needs `finalized_at`.
- A participation row is created on join and updated on submit. It doubles as the leaderboard: `(contest_id, score desc, submitted_at asc)` is indexed (partial index on submitted rows), so ranking is one indexed scan with a window function.
- Answers are stored per question so a user can review their result later and so the score can be recomputed if needed.
- One prize per contest (`unique (contest_id)`): the database enforces "award once", not the application.
- Tags are a `text[]` with a GIN index; the full-text vector is a generated column, so search never goes stale.

## Request flow and access rules

```
request -> pino-http (request id) -> json -> general rate limit -> router
       -> optionalAuth / requireAuth / requireRole -> zod validate -> handler -> error handler
```

- `optionalAuth` lets guests through but still rejects a broken or expired token, so a client with a stale session gets a 401 instead of silently becoming a guest.
- Access to a contest is one function, `canParticipate(user, contest)`: admin and vip can do anything, user only normal contests, guest nothing. Both join and submit call it, and every contest in a list carries `can_participate` for the caller so clients do not have to re-implement the rule.
- Questions are only readable after joining, and participants never receive `correct_answers` or `explanation` until they have submitted (`/result`).

## Concurrency

Three places can race and each is handled in the database, not with application locks:

| operation | what could go wrong | how it is handled |
|---|---|---|
| join | two requests create two participations | `insert ... on conflict do nothing`; the second request gets the existing row with 200 |
| submit | two submits both score and overwrite each other | transaction + `select ... for update` on the participation; the second one sees `submitted_at` set and gets 409 |
| finalize | two workers award the prize twice | `update contests set finalized_at = now() where finalized_at is null and end_time <= now() returning *` is the gate; only one update wins. The worker loop also takes `pg_try_advisory_xact_lock` so several instances do not even try at the same time. `prizes.contest_id` is unique as a last line of defence |

The tests fire 6 parallel joins and 5 parallel submits and check exactly one wins.

## Scoring and ranking

Score is computed inside the submit transaction from the questions as stored at that moment. Multi-select requires the exact set. Ties are broken by earlier `submitted_at`, which is also what the finalizer uses, so the leaderboard and the winner can never disagree. The leaderboard query uses `rank()` so equal scores at different times still rank differently; the overall leaderboard sums scores across contests.

## Performance notes

- Every list endpoint is paginated and backed by an index (`start_time, end_time`, `access_level`, tags GIN, tsvector GIN, the leaderboard index, `(user_id, joined_at)`).
- The submit path does two indexed reads, two writes, in one transaction.
- The AI search interprets the sentence once and caches the interpretation for 10 minutes keyed by the normalised query; popular queries cost nothing after the first call. The database does the real filtering.
- Knex pool max 10; the app is stateless apart from the in-memory rate limiter and search cache, so it scales horizontally. With more than one replica the limiter should move to Redis (`rate-limit-redis` is a drop-in store).

## Rate limiting and abuse

Three limiters: 300 requests / 15 min per IP (per user once logged in), 20 / 15 min on login and register per IP, and 10 / min per user on anything that calls the model. AI endpoints are also admin-only (generation) or cached (search). Bodies are capped at 200 KB, option lists at 6, question batches at 50, generation at 20 questions.

## Logging

`pino` JSON logs. Every request logs method, path, status and duration with a request id (`x-request-id` is honoured if the client sends one). Business events are logged with the ids needed to trace them: user registered / logged in / failed login, contest created / updated / deleted, questions added / generated (with counts and provider), contest joined, answers submitted (score), contest finalized (winner, prize), AI calls (model, latency, tokens, stop reason) and every 5xx.

## Testing

22 tests in four files, each starting from a truncated database:

- auth: register/login/me, validation details, bad and expired tokens, role changes.
- contests: admin CRUD and permissions, list filters, per-role `can_participate`, question validation.
- participation: join rules, concurrent joins, question visibility, scoring of all three types, invalid answers, double and late submits, concurrent submits, leaderboard order, double finalize, prizes, history, in-progress, the worker.
- ai: query interpretation, search through the API with cache and fallback, rate limit, generation with preview and save, admin-only.

Tests run on the mock provider so they are deterministic and free. The Anthropic provider was exercised manually (see AI_USAGE.md).

## What changed while building

- I first put tags into the full-text vector with `array_to_string`, which Postgres rejects in a generated column because it is not immutable; `array_to_tsvector(tags)` is.
- The PATCH schema could not be `contestBody.partial()` because zod 4 refuses to partial a refined schema, so the start/end check for updates moved into the handler against the merged row.

## If I had more time

- Refresh tokens and a token version on the user so role changes and logouts take effect immediately.
- Timed contests (a per-user deadline from `joined_at`) and server-side shuffling of options.
- Redis for the rate limiter and the search cache when running more than one instance.
- A small admin UI, and OpenAPI generated from the zod schemas.
