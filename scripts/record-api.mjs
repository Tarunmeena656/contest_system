// Runs every endpoint against a live server and writes each request and
// response into docs/walkthrough.md, between the <!-- api:start --> and
// <!-- api:end --> markers. The prose above the markers is hand-written and
// left alone. Everything the script creates is deleted at the end, except the
// users it registers.
//
//   AI_PROVIDER=mock FINALIZER_INTERVAL_MS=5000 PORT=3100 npx tsx src/server.ts
//   node scripts/record-api.mjs http://localhost:3100/api [http://localhost:3101/api]
//
// The optional second url points at a server running the real Anthropic
// provider and is only used for the "provider errors" section.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:3000/api';
const REAL = process.argv[3];
const DOC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/walkthrough.md');

const sections = [];
let current;
let counter = 0;

function section(title, intro) {
  current = { title, intro, entries: [] };
  sections.push(current);
}

async function call(method, route, { as, token, body, raw, base = BASE } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined || raw !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(base + route, {
    method,
    headers,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text || null;
  }
  return { method, route, as, body, raw, status: res.status, statusText: res.statusText, json, headers: res.headers };
}

// records a call in the current section and returns it so the flow can use the data
async function rec(title, promise, note) {
  const r = await promise;
  current.entries.push({ n: ++counter, title, note, ...r });
  return r;
}

function text(markdown) {
  current.entries.push({ markdown });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const code = (r) => r.json?.error?.code;

// jwt tokens are long and secret-ish, long lists are noise
function tidy(value) {
  if (Array.isArray(value)) return value.map(tidy);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'token' && typeof v === 'string') {
        out[k] = v.slice(0, 20) + '...';
      } else if (k === 'items' && Array.isArray(v) && v.length > 3) {
        out[k] = v.slice(0, 3).map(tidy);
        out[k].push(`... ${v.length - 3} more`);
      } else {
        out[k] = tidy(v);
      }
    }
    return out;
  }
  return value;
}

const fence = (obj) => '```json\n' + JSON.stringify(tidy(obj), null, 2) + '\n```';

function render() {
  const lines = [];
  lines.push(
    `Recorded on ${new Date().toISOString().slice(0, 10)} against \`${BASE}\` with \`AI_PROVIDER=mock\`. Tokens are shortened and long lists are cut after three items. Every call below was made by \`scripts/record-api.mjs\`.`,
  );
  lines.push('');
  lines.push('| # | call | status |');
  lines.push('|---|---|---|');
  for (const s of sections) {
    for (const e of s.entries) {
      if (e.n) lines.push(`| ${e.n} | \`${e.method} ${e.route}\`${e.as ? ` (${e.as})` : ''} | ${e.status} |`);
    }
  }
  lines.push('');
  for (const s of sections) {
    lines.push(`### ${s.title}`);
    lines.push('');
    if (s.intro) {
      lines.push(s.intro);
      lines.push('');
    }
    for (const e of s.entries) {
      if (e.markdown) {
        lines.push(e.markdown);
        lines.push('');
        continue;
      }
      lines.push(`#### ${e.n}. ${e.title}`);
      lines.push('');
      lines.push(`\`${e.method} ${e.route}\`${e.as ? ` as ${e.as}` : ' with no token'}`);
      lines.push('');
      if (e.raw !== undefined) {
        lines.push('Request body (raw):');
        lines.push('```');
        lines.push(e.raw);
        lines.push('```');
        lines.push('');
      } else if (e.body !== undefined) {
        lines.push('Request body:');
        lines.push(fence(e.body));
        lines.push('');
      }
      lines.push(`Response \`${e.status} ${e.statusText}\`${e.json === null ? ' (empty body)' : ':'}`);
      if (e.json !== null) lines.push(fence(e.json));
      if (e.note) {
        lines.push('');
        lines.push(e.note);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}

async function waitForServer(base) {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await fetch(base + '/health')).ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error(`no server at ${base}`);
}

await waitForServer(BASE);
if (REAL) await waitForServer(REAL);
const stamp = Date.now();

// ---------------------------------------------------------------------------
section(
  'Health',
  'The only route outside `/api/auth`, `/api/contests`, `/api/users`, `/api/leaderboard` and `/api/me`. Load balancers and the Postman collections use it.',
);
await rec('Health check', call('GET', '/health'));

// ---------------------------------------------------------------------------
section(
  'Auth and roles',
  'Registration always creates a `user`. Login returns a JWT whose payload is `{ sub, role }`; the role check on every later request reads the token, not the database, so a promotion needs a fresh login.',
);
const userEmail = `walk-user-${stamp}@example.com`;
const reg = await rec(
  'Register a new user',
  call('POST', '/auth/register', { body: { name: 'Walkthrough User', email: userEmail, password: 'password123' } }),
  'A token comes back straight away, so the client does not need a second login call. The password is stored as a bcrypt hash (cost 10) and never returned.',
);
const user = reg.json.token;
const userId = reg.json.user.id;
await rec(
  'Register with the same email again',
  call('POST', '/auth/register', { body: { name: 'Walkthrough User', email: userEmail, password: 'password123' } }),
  'The controller checks first and answers `409 EMAIL_TAKEN`; the `unique` index on `users.email` is the safety net if two registrations race.',
);
await rec(
  'Register with invalid input',
  call('POST', '/auth/register', { body: { email: 'not-an-email', password: '123' } }),
  'Every validation failure has the same shape: `VALIDATION_ERROR` with one `{ field, message }` per problem. Zod produces it, the `validate` middleware formats it.',
);
await rec(
  'Login with a wrong password',
  call('POST', '/auth/login', { body: { email: 'user@contest.dev', password: 'wrong' } }),
  'Same message whether the email or the password is wrong, so the endpoint does not reveal which accounts exist. The failed attempt is logged with the email.',
);
const adminLogin = await rec(
  'Login as the seeded admin',
  call('POST', '/auth/login', { body: { email: 'admin@contest.dev', password: 'Admin123!' } }),
);
const admin = adminLogin.json.token;
await rec(
  'Who am I',
  call('GET', '/auth/me', { as: 'user', token: user }),
  'Reads the user from the database, so a deleted account is caught even if its token is still valid.',
);
await rec(
  'Protected route without a token',
  call('GET', '/me/history'),
  '`401 UNAUTHENTICATED`. `requireAuth` runs before any handler code.',
);
await rec(
  'Protected route with a bad token',
  call('GET', '/me/history', { as: 'garbage token', token: 'not-a-jwt' }),
  'A malformed or expired token is `401 INVALID_TOKEN`, even on routes where guests are allowed, so clients notice an expired session instead of silently becoming a guest.',
);

const vipEmail = `walk-vip-${stamp}@example.com`;
const vipReg = await call('POST', '/auth/register', {
  body: { name: 'Walkthrough VIP', email: vipEmail, password: 'password123' },
});
await rec(
  'Admin promotes a user to VIP',
  call('PATCH', `/users/${vipReg.json.user.id}/role`, { as: 'admin', token: admin, body: { role: 'vip' } }),
  '`requireRole("admin")` guards this. Allowed values: `user`, `vip`, `admin`.',
);
await rec(
  'A normal user tries to change a role',
  call('PATCH', `/users/${vipReg.json.user.id}/role`, { as: 'user', token: user, body: { role: 'admin' } }),
  '`403 FORBIDDEN`. The role check happens before validation, so the body is never even looked at.',
);
await rec(
  'Admin lists users',
  call('GET', '/users?q=walk&pageSize=5', { as: 'admin', token: admin }),
  'Admin only. `q` matches name or email, newest accounts first. The frontend uses this to find the account whose role to change.',
);
const vipLogin = await rec(
  'The promoted user logs in again',
  call('POST', '/auth/login', { body: { email: vipEmail, password: 'password123' } }),
  'The old token still says `role: "user"`. This one says `vip`.',
);
const vip = vipLogin.json.token;
const lateReg = await call('POST', '/auth/register', {
  body: { name: 'Walkthrough Late', email: `walk-late-${stamp}@example.com`, password: 'password123' },
});
const late = lateReg.json.token;

// ---------------------------------------------------------------------------
section(
  'Browsing contests (guest)',
  'Listing and viewing are open to everyone. `status` is computed from `start_time` and `end_time` at request time, never stored. `can_participate` is computed per caller.',
);
const list = await rec(
  'List contests',
  call('GET', '/contests'),
  'Paginated (`page`, `pageSize` up to 100), ordered by `start_time`. For a guest `can_participate` is always `false`.',
);
const seeded = Object.fromEntries(list.json.items.map((c) => [c.name, c]));
const jsContest = seeded['JavaScript Basics'];
const nodeVip = seeded['Node.js Backend Challenge'];
const sqlUpcoming = seeded['SQL Weekend Sprint'];
await rec(
  'Filter: active VIP contests',
  call('GET', '/contests?status=active&access=vip'),
  'Filters are plain SQL `where` clauses built in `applyFilters`. They combine freely with `difficulty`, `tag` and `q`.',
);
await rec(
  'Filter: by tag',
  call('GET', '/contests?tag=sql'),
  'Tags are a Postgres `text[]` column with a GIN index; the match is case-insensitive.',
);
await rec(
  'Filter: full-text search',
  call('GET', '/contests?q=streams'),
  '`q` goes through `plainto_tsquery` against a generated `tsvector` column (name, description and tags), backed by a GIN index. "streams" is found in the Node contest description.',
);
await rec(
  'Filter with an invalid value',
  call('GET', '/contests?status=later'),
  'Query strings are validated like bodies.',
);
await rec(
  'View one contest',
  call('GET', `/contests/${jsContest.id}`),
  'Adds `question_count`, `participant_count` and, for a signed-in caller, `my_participation`.',
);
await rec(
  'View a contest that does not exist',
  call('GET', '/contests/00000000-0000-0000-0000-000000000000'),
  '`404 CONTEST_NOT_FOUND` from `getContest`, shared by every `/:id` route.',
);
await rec(
  'View with a malformed id',
  call('GET', '/contests/not-a-uuid'),
  'Caught by the `idParam` schema before any SQL runs.',
);

// ---------------------------------------------------------------------------
section(
  'Admin: contests and questions',
  'Only admins create, edit and delete contests and questions. The contest created here runs for about 25 seconds so the finalizer section can show it ending.',
);
const soon = new Date(Date.now() + 25_000);
await rec(
  'Create a contest as a VIP',
  call('POST', '/contests', { as: 'vip', token: vip, body: { name: 'Nope', start_time: new Date(), end_time: soon } }),
  'VIP is still not admin.',
);
await rec(
  'Create a contest with end before start',
  call('POST', '/contests', {
    as: 'admin',
    token: admin,
    body: { name: 'Backwards', start_time: new Date(), end_time: new Date(Date.now() - 1000) },
  }),
  'The zod schema has a `refine` for the date order and reports it on the `end_time` field. The database has the same rule as a `check` constraint.',
);
const created = await rec(
  'Create a contest',
  call('POST', '/contests', {
    as: 'admin',
    token: admin,
    body: {
      name: `Walkthrough Contest ${stamp}`,
      description: 'Created by the walkthrough script. Ends in a few seconds.',
      access_level: 'normal',
      difficulty: 'intermediate',
      tags: ['javascript', 'backend'],
      prize: 'Walkthrough trophy',
      start_time: new Date(Date.now() - 1000),
      end_time: soon,
    },
  }),
  'Defaults fill in what is not sent (`description`, `access_level`, `difficulty`, `tags`, `prize`). Tags are lower-cased. `status` is already `active` because `start_time` is in the past.',
);
const cid = created.json.id;
await rec(
  'Edit a contest',
  call('PATCH', `/contests/${cid}`, {
    as: 'admin',
    token: admin,
    body: { description: 'Edited by the walkthrough script.' },
  }),
  'A PATCH only touches the fields it names: `prize` and `tags` are unchanged. The schema for PATCH deliberately has no defaults.',
);
await rec(
  'Add questions with a mistake',
  call('POST', `/contests/${cid}/questions`, {
    as: 'admin',
    token: admin,
    body: {
      questions: [{ type: 'true-false', text: 'Wrong options', options: ['Yes', 'No'], correct_answers: ['Yes'] }],
    },
  }),
  'Question rules live in one zod schema: unique options, every correct answer must be an option, true/false must use exactly `["True", "False"]`, single-select and true/false have exactly one answer. The field path points at the exact question.',
);
const added = await rec(
  'Add questions',
  call('POST', `/contests/${cid}/questions`, {
    as: 'admin',
    token: admin,
    body: {
      questions: [
        {
          type: 'single-select',
          text: 'Which phase of the event loop runs setImmediate callbacks?',
          options: ['timers', 'poll', 'check', 'close callbacks'],
          correct_answers: ['check'],
          explanation: 'setImmediate runs in the check phase.',
        },
        {
          type: 'multi-select',
          text: 'Which of these are readable stream events?',
          options: ['data', 'end', 'drain', 'error'],
          correct_answers: ['data', 'end', 'error'],
          points: 2,
        },
        {
          type: 'true-false',
          text: 'process.nextTick callbacks run before promise microtasks.',
          options: ['True', 'False'],
          correct_answers: ['True'],
        },
      ],
    },
  }),
  "`position` continues from the contest's current last question inside a transaction. `points` defaults to 1; the multi-select here is worth 2.",
);
await rec(
  'Generate questions: preview',
  call('POST', `/contests/${cid}/questions/generate`, {
    as: 'admin',
    token: admin,
    body: {
      topic: 'JavaScript',
      difficulty: 'medium',
      count: 3,
      questionTypes: ['single-select', 'multi-select', 'true-false'],
      save: false,
    },
  }),
  '`save: false` returns the questions without storing them. `provider` says who answered: here the mock, which picks real questions from its built-in bank. Model output is validated with the same question schema as the admin endpoint; anything that fails is counted in `rejected`.',
);
const gen = await rec(
  'Generate questions and save them',
  call('POST', `/contests/${cid}/questions/generate`, {
    as: 'admin',
    token: admin,
    body: { topic: 'JavaScript', difficulty: 'medium', count: 2, questionTypes: ['true-false'] },
  }),
  '`201` because rows were written. The saved rows look exactly like hand-written questions: same table, same columns, `position` continues after the three above.',
);
const adminView = await rec(
  'Questions as seen by an admin',
  call('GET', `/contests/${cid}/questions`, { as: 'admin', token: admin }),
  'Admins get `correct_answers` and `explanation` without joining. The two generated questions are stored with their real text and options.',
);
const questions = adminView.json.questions;
const correctFor = (q) => q.correct_answers;

// ---------------------------------------------------------------------------
section(
  'Participating (normal user)',
  'Join, read the questions, submit once. Access rules: guests cannot join, `user` cannot join VIP contests, nothing can be joined unless the contest is active.',
);
await rec('Join without a token', call('POST', `/contests/${cid}/join`), '`401`. Joining needs an account.');
await rec(
  'Join a VIP contest as a normal user',
  call('POST', `/contests/${nodeVip.id}/join`, { as: 'user', token: user }),
  '`403 VIP_ONLY` from `assertCanParticipate`. VIP and admin pass; `user` only passes for `normal` contests.',
);
await rec(
  'Join an upcoming contest',
  call('POST', `/contests/${sqlUpcoming.id}/join`, { as: 'user', token: user }),
  '`409 CONTEST_NOT_ACTIVE`. The same check blocks ended contests.',
);
await rec(
  'Read questions before joining',
  call('GET', `/contests/${cid}/questions`, { as: 'user', token: user }),
  '`403 NOT_JOINED`. Questions are only visible to participants, so nobody can read them without being on the list.',
);
const join = await rec(
  'Join the contest',
  call('POST', `/contests/${cid}/join`, { as: 'user', token: user }),
  '`201` with the participation row. The insert uses `on conflict do nothing` on `unique (contest_id, user_id)`, so two simultaneous joins cannot create two rows.',
);
await rec(
  'Join the same contest again',
  call('POST', `/contests/${cid}/join`, { as: 'user', token: user }),
  'Idempotent: `200` with the existing row instead of an error.',
);
await rec(
  'Read questions as a participant',
  call('GET', `/contests/${cid}/questions`, { as: 'user', token: user }),
  '`correct_answers` and `explanation` are stripped for participants. Compare with the admin view above.',
);
await rec(
  'Submit an answer that is not an option',
  call('POST', `/contests/${cid}/submit`, {
    as: 'user',
    token: user,
    body: { answers: [{ questionId: questions[0].id, selected: ['not an option'] }] },
  }),
  '`400 INVALID_OPTION`. Also rejected: unknown question ids (`UNKNOWN_QUESTION`), the same question twice (`DUPLICATE_ANSWER`), several answers to a single-select question.',
);
const userAnswers = [
  { questionId: questions[0].id, selected: correctFor(questions[0]) }, // correct, 1 point
  { questionId: questions[1].id, selected: [correctFor(questions[1])[0]] }, // partial multi-select, 0
  { questionId: questions[2].id, selected: correctFor(questions[2]) }, // correct, 1 point
  { questionId: questions[3].id, selected: correctFor(questions[3]) }, // generated, correct, 1 point
  // questions[4] left unanswered on purpose
];
const submit = await rec(
  'Submit answers',
  call('POST', `/contests/${cid}/submit`, { as: 'user', token: user, body: { answers: userAnswers } }),
  'Scoring: a fully correct question adds its `points`, anything else adds 0. The multi-select got one of three answers, so it scores 0; the last question was not answered, also 0. `rank` is computed on the spot. The whole submit runs in one transaction with `select ... for update` on the participation row.',
);
await rec(
  'Submit a second time',
  call('POST', `/contests/${cid}/submit`, { as: 'user', token: user, body: { answers: [] } }),
  '`409 ALREADY_SUBMITTED`. One submission per participation.',
);
await rec(
  'My result',
  call('GET', `/contests/${cid}/result`, { as: 'user', token: user }),
  'After submitting, the user gets every question with the correct answers, their own selection and `is_correct`.',
);
await call('POST', `/contests/${cid}/join`, { token: late });
await rec(
  'In-progress contests (a user who joined but has not submitted)',
  call('GET', '/me/in-progress', { as: 'late user', token: late }),
  '`missed` is `false` while the contest is still running.',
);

text(
  `**Concurrency check.** Five joins and five submits for the same user fired at the same time with \`Promise.all\`:`,
);
const joins = await Promise.all(
  Array.from({ length: 5 }, () => call('POST', `/contests/${cid}/join`, { token: late })),
);
const vipJoin = await call('POST', `/contests/${cid}/join`, { token: vip });
const subs = await Promise.all(
  Array.from({ length: 5 }, () =>
    call('POST', `/contests/${cid}/submit`, {
      token: vip,
      body: { answers: questions.map((q) => ({ questionId: q.id, selected: correctFor(q) })) },
    }),
  ),
);
text(
  `- 5 parallel joins → statuses \`${joins.map((r) => r.status).join(', ')}\` (the row already existed, so all five are the idempotent 200)\n` +
    `- 5 parallel submits (VIP, all answers correct) → statuses \`${subs.map((r) => r.status).join(', ')}\`: exactly one \`200\`, the rest \`409 ALREADY_SUBMITTED\`. The row lock makes the other four wait and then see \`submitted_at\` already set.\n` +
    `- VIP join before that returned \`${vipJoin.status}\`. VIPs can join normal contests too.`,
);

// ---------------------------------------------------------------------------
section(
  'Leaderboards',
  'Ranking is `rank() over (order by score desc, submitted_at asc)`: higher score first, earlier submission wins ties, equal rows share a rank.',
);
await rec(
  'Contest leaderboard with my position',
  call('GET', `/contests/${cid}/leaderboard`, { as: 'user', token: user }),
  "`me` is the caller's own row even when it is not on the current page. Guests get `me: null`.",
);
await rec(
  'Overall leaderboard',
  call('GET', '/leaderboard'),
  'Total score across every finished contest, with `contests_played` and `prizes_won`. Ties share a rank; rows are then ordered by prizes and name so pages never shuffle.',
);

// ---------------------------------------------------------------------------
section(
  'Finalization and prizes',
  'When a contest ends, the finalizer picks the winner (highest score, earliest submission) and writes a `prizes` row if the contest has a prize. The worker runs every `FINALIZER_INTERVAL_MS` (5 seconds in this recording) and an admin can trigger it by hand.',
);
await rec(
  'Finalize while the contest is still running',
  call('POST', `/contests/${cid}/finalize`, { as: 'admin', token: admin }),
  '`409 CONTEST_NOT_ENDED`.',
);
const waitMs = soon.getTime() - Date.now() + 8000;
text(`_The script now waits ${Math.ceil(waitMs / 1000)} seconds for the contest to end and for the worker to run._`);
await sleep(Math.max(waitMs, 0));
await rec(
  'The contest after the worker ran',
  call('GET', `/contests/${cid}`),
  '`status` is `ended`, `finalized_at` is set and `winner_user_id` is the VIP (full marks). Nobody called finalize; the worker did it. It takes `pg_try_advisory_xact_lock` first so several app instances never finalize the same contest twice, and the `update ... where finalized_at is null` is the second guard.',
);
await rec(
  'Finalize again by hand',
  call('POST', `/contests/${cid}/finalize`, { as: 'admin', token: admin }),
  '`409 ALREADY_FINALIZED`. Finalization is idempotent.',
);
await rec(
  'Prizes of the winner',
  call('GET', '/me/prizes', { as: 'vip', token: vip }),
  'One row per won contest, with the contest name.',
);
await rec(
  'Prizes of the runner-up',
  call('GET', '/me/prizes', { as: 'user', token: user }),
  'Only the winner gets the prize.',
);
await rec(
  'History of the winner',
  call('GET', '/me/history', { as: 'vip', token: vip }),
  'Finished contests, newest first, with `score`, `rank`, `won` and the contest status. The rank is computed with a correlated subquery, the same rule as the leaderboard.',
);
await rec(
  'In-progress after the contest ended',
  call('GET', '/me/in-progress', { as: 'late user', token: late }),
  'The user who joined but never submitted now sees `missed: true`.',
);
await rec(
  'Submit after the end',
  call('POST', `/contests/${cid}/submit`, { as: 'late user', token: late, body: { answers: [] } }),
  '`409 CONTEST_NOT_ACTIVE`. Late answers are refused.',
);

// ---------------------------------------------------------------------------
section(
  'Natural-language search',
  'The model (or the mock) only turns the sentence into a fixed set of filters; the database does the search with the same `applyFilters` as the list endpoint. Interpretations are cached for 10 minutes per normalised query.',
);
const nl = (q, opts) => call('GET', `/contests/search?q=${encodeURIComponent(q)}`, opts);
await rec(
  '"Show me active VIP contests"',
  nl('Show me active VIP contests'),
  '`filters` is what the sentence was reduced to; `null` means the sentence did not say. `cached: false` on the first call.',
);
await rec(
  '"Find beginner contests about JavaScript"',
  nl('Find beginner contests about JavaScript'),
  'Topics are matched against contest tags.',
);
await rec(
  '"I want a difficult JavaScript contest starting this week"',
  nl('I want a difficult JavaScript contest starting this week'),
  '"difficult" → `advanced`, "starting this week" → `upcoming` within 7 days.',
);
await rec(
  '"Show me contests related to backend development with prizes"',
  nl('Show me contests related to backend development with prizes'),
  '`hasPrize: true` becomes `where prize is not null`.',
);
await rec(
  '"show me ACTIVE   vip contests" (repeat)',
  nl('show me ACTIVE   vip contests'),
  'Case and whitespace are normalised, so this is the first query again: `cached: true`, no model call.',
);
await rec(
  '"typescript contests" (no such tag)',
  nl('typescript contests'),
  'No contest carries a `typescript` tag, so the search falls back to full-text on name and description (`relaxed: true`) and still finds the TypeScript quiz.',
);

// ---------------------------------------------------------------------------
section(
  'Rate limiting',
  'Three limiters from `express-rate-limit`: general (300 per 15 minutes per user or IP), auth (20 per 15 minutes per IP on register and login) and AI (10 per minute per user or IP on search and generation). All answer `429 RATE_LIMITED` with standard `RateLimit` headers.',
);
const probes = [];
let limited;
for (let i = 0; i < 12; i++) {
  const r = await nl(`rate limit probe ${i}`, { as: 'user', token: user });
  probes.push(r.status);
  if (r.status === 429 && !limited) limited = r;
}
text(`Twelve different searches by the same user within a minute → statuses \`${probes.join(', ')}\`.`);
if (limited) {
  current.entries.push({
    n: ++counter,
    title: 'The 11th search in a minute',
    method: 'GET',
    route: '/contests/search?q=rate limit probe 10',
    as: 'user',
    status: limited.status,
    statusText: limited.statusText,
    json: limited.json,
    note: `Headers: \`RateLimit: ${limited.headers.get('ratelimit')}\`, \`RateLimit-Policy: ${limited.headers.get('ratelimit-policy')}\`. The limiter runs before validation and before the cache, so cached queries count too.`,
  });
}

// ---------------------------------------------------------------------------
section(
  'Error handling',
  'One error handler at the end of the chain. `AppError` carries status, code, message and optional details; everything else is mapped or becomes a `500` with the request id.',
);
await rec(
  'Malformed JSON body',
  call('POST', '/auth/login', { raw: '{"email": ' }),
  '`express.json` throws a `SyntaxError`; the handler turns it into `400 INVALID_JSON`.',
);
await rec('Unknown route', call('GET', '/nope'), '`404 NOT_FOUND` as JSON, never an HTML page.');

// ---------------------------------------------------------------------------
if (REAL) {
  section(
    'Provider errors (real Anthropic provider)',
    `Recorded against \`${REAL}\`, a second instance started with \`AI_PROVIDER=anthropic\` and an API key whose account has no credit. The two AI endpoints fail cleanly; nothing else is affected.`,
  );
  await rec(
    'Search with a key that has no credit',
    call('GET', '/contests/search?q=' + encodeURIComponent('active contests'), { base: REAL }),
    'The SDK error is mapped to `502 AI_UNAVAILABLE` with the provider status in the message. The real reason (the billing message) is in the server log with the request id, never in the response. Other mappings: provider rate limit → `503 AI_RATE_LIMITED`, bad key → `500 AI_MISCONFIGURED`, model refusal → `422 AI_REFUSED`, unusable output → `502 AI_BAD_OUTPUT`.',
  );
  await rec(
    'Generation with a key that has no credit',
    call('POST', `/contests/${cid}/questions/generate`, {
      base: REAL,
      as: 'admin',
      token: admin,
      body: { topic: 'SQL', count: 2, save: false },
    }),
    'Same mapping. With credit, this returns Claude-written questions and `provider: "anthropic"`.',
  );
}

// ---------------------------------------------------------------------------
section(
  'Cleanup',
  'The contest created above is removed. Deleting a contest cascades to its questions, participations, answers and prize.',
);
await rec(
  'Delete the contest',
  call('DELETE', `/contests/${cid}`, { as: 'admin', token: admin }),
  '`204` with no body.',
);
await rec('View the deleted contest', call('GET', `/contests/${cid}`), 'Gone.');

// ---------------------------------------------------------------------------
const doc = readFileSync(DOC, 'utf8');
const start = doc.indexOf('<!-- api:start -->');
const end = doc.indexOf('<!-- api:end -->');
if (start === -1 || end === -1) throw new Error('markers not found in docs/walkthrough.md');
const updated = doc.slice(0, start) + '<!-- api:start -->\n\n' + render() + '\n' + doc.slice(end);
writeFileSync(DOC, updated);
console.log(`recorded ${counter} calls into ${path.relative(process.cwd(), DOC)}`);
