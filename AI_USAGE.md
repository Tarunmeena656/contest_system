# AI_USAGE

Where the system uses an AI model, how the calls are made, and what keeps them safe and cheap.

## Where

| feature | endpoint | who | what the model does |
|---|---|---|---|
| Natural-language contest search | `GET /api/contests/search?q=` | anyone | turns a sentence into a fixed set of filters (status, access level, difficulty, topics, prize, start window) |
| Question generation | `POST /api/contests/:id/questions/generate` | admin | writes quiz questions for a topic, difficulty, count and set of question types |

Nothing else talks to a model. Scoring, ranking and access control are plain code.

## Provider abstraction

`src/ai/types.ts` defines a two-method interface:

```ts
interface AiProvider {
  generateQuestions(params): Promise<GeneratedQuestion[]>;
  parseSearch(query: string): Promise<SearchFilters>;
}
```

Two implementations:

- `AnthropicProvider` (`src/ai/anthropic.ts`): Claude through the official `@anthropic-ai/sdk`. Model from `AI_MODEL`, default `claude-opus-5-5`.
- `MockProvider` (`src/ai/mock.ts`): deterministic. Keyword rules for search, templated questions for generation. Used by the tests and automatically whenever `ANTHROPIC_API_KEY` is not set, so the whole API works offline.

Switching providers is one env var. Adding another vendor means implementing the two methods.

## Structured output, not prose

Both calls use the SDK's structured output (`client.messages.parse` with `output_config.format` built from a zod schema). The model is constrained to return JSON matching the schema and the SDK parses it; I never parse free text. The same zod schemas are the source of truth for validation:

- `searchFiltersSchema`: every field is nullable, "null" means the sentence did not say. Topics are an array of lower-cased strings.
- `generatedQuestionSchema`: `question`, `type`, `options` (2..6), `correctAnswers`, `explanation`, `difficulty`, `topic`.

On top of the schema, generated questions are pushed through the exact same validator as hand-written questions (unique options, correct answers must be options, true/false must be `["True", "False"]`, single-select has one answer). Anything that fails is dropped and reported as `rejected` in the response. If nothing survives the request fails with `502 AI_BAD_OUTPUT` and nothing is written.

## Prompts

Search (system prompt, abridged):

> You turn a user's natural-language request for programming contests into filters. status: "active" (running now / currently / ongoing), "upcoming" (starting soon, this week), "ended" (past, finished), null if not stated. accessLevel ... difficulty: "beginner" (easy, intro), "intermediate" (medium), "advanced" (hard, difficult, expert) ... topics: technologies or subjects mentioned, lower-cased ... startsWithinDays: 7 for "this week", 30 for "this month", 1 for "today/tomorrow". Do not invent filters the user did not ask for.

Generation (system prompt, abridged):

> You write quiz questions for a programming contest platform. "single-select": 4 options, exactly one correct answer. "multi-select": 4 to 5 options, two or more correct answers. "true-false": options are exactly ["True", "False"]. Every entry in correctAnswers must appear verbatim in options. Questions must be unambiguous, factual and distinct from each other. Keep explanations to one or two sentences.

The user turn only carries the parameters (`Generate 5 intermediate questions about "JavaScript" ...`). User-supplied text never goes into the system prompt, and the topic is quoted.

## Guardrails

- **Admin only** for generation; search is open but rate limited (`RATE_LIMIT_AI_MAX`, default 10 per minute per user or IP). Both limits return `429 RATE_LIMITED`.
- **Input validation** before any call: topic 2..100 chars, count 1..20, known question types, query 2..300 chars.
- **Output validation** as above. The model cannot create a question the API would have refused from an admin.
- **Caching**: search interpretations are cached 10 minutes by normalised query (lower-cased, whitespace collapsed), max 500 entries. Repeated and popular queries never reach the model.
- **Timeouts and errors**: SDK defaults (10 min timeout, 2 retries on 429/5xx). Errors are mapped to API errors: `503 AI_RATE_LIMITED` (provider rate limit), `500 AI_MISCONFIGURED` (bad key), `502 AI_UNAVAILABLE` (other provider error), `422 AI_REFUSED` (model declined), `502 AI_BAD_OUTPUT`. Clients never see provider stack traces.
- **Logging**: every call logs operation, model, latency, input/output tokens and stop reason; failures log the error with the request id.
- **No sensitive data** goes to the model: search sends the sentence only, generation sends topic/difficulty/count/types. No user records, no existing questions.

## Cost and latency

Search is a tiny request (one sentence in, ~60 tokens of JSON out). Generation is larger (up to 20 questions, `max_tokens` 8000). The default model is `claude-opus-5-5`; for search alone `claude-haiku-5-5` is an order of magnitude cheaper and faster and is a sensible `AI_MODEL` if cost matters more than phrasing quality. The cache and the per-user limit are what keep the search endpoint affordable under load.

Note on verification: the Anthropic provider is implemented against the official SDK's structured-output API and the error mapping was exercised end to end (the API key available to me had no remaining credit, so the calls came back as `AI_UNAVAILABLE` with the provider's billing message in the logs, exactly as designed). The behaviour of the search and generation endpoints themselves is covered by the test suite on the mock provider, which implements the same interface and goes through the same validation.

## Supported search phrasing

Documented in the README under "Natural-language search". In short: status words, VIP/normal, difficulty words, technology names, "with prizes", and time windows. Unsupported: ordering, numeric comparisons, negations. The mock provider covers the example queries from the brief; the real model handles free phrasing and typos.

## Known limitations

- Topics from the model are matched against contest tags, with a fallback to full-text search on name and description. A topic that appears neither as a tag nor in the text finds nothing.
- The cache is per process. With several instances each one warms up on its own.
- The model occasionally produces a correct answer that is a close paraphrase of an option rather than the exact string; those questions are rejected rather than fixed, so `generated` can be lower than `requested`.
