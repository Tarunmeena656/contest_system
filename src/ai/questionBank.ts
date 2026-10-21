import { difficulties, questionTypes } from './types';

type QuestionType = (typeof questionTypes)[number];
type Difficulty = (typeof difficulties)[number];

export interface BankQuestion {
  type: QuestionType;
  difficulty: Difficulty;
  text: string;
  options: string[];
  correct: string[];
  explanation: string;
}

interface TopicBank {
  keys: string[];
  questions: BankQuestion[];
}

const q = (
  type: QuestionType,
  difficulty: Difficulty,
  text: string,
  options: string[],
  correct: string[],
  explanation: string,
): BankQuestion => ({ type, difficulty, text, options, correct, explanation });

const tf = (difficulty: Difficulty, text: string, answer: boolean, explanation: string) =>
  q('true-false', difficulty, text, ['True', 'False'], [answer ? 'True' : 'False'], explanation);

// Hand-written questions the mock provider hands out when there is no API key.
// Small on purpose: enough for a demo, not a replacement for the model.
const topics: TopicBank[] = [
  {
    keys: ['node', 'nodejs', 'express', 'npm'],
    questions: [
      q(
        'single-select',
        'beginner',
        'Which built-in module creates an HTTP server without any framework?',
        ['http', 'net', 'url', 'server'],
        ['http'],
        'http.createServer is the base that frameworks like Express build on.',
      ),
      q(
        'single-select',
        'intermediate',
        'When does a process.nextTick callback run?',
        [
          'Right after the current operation, before promise callbacks and I/O',
          'After the next setTimeout fires',
          'On a separate worker thread',
          'When the process exits',
        ],
        ['Right after the current operation, before promise callbacks and I/O'],
        'The nextTick queue is drained before the promise microtask queue and before the event loop continues.',
      ),
      q(
        'single-select',
        'intermediate',
        'Which stream type is both readable and writable?',
        ['Duplex', 'Readable', 'Writable', 'Pipe'],
        ['Duplex'],
        'Duplex (and Transform) streams implement both sides; a TCP socket is one.',
      ),
      q(
        'single-select',
        'advanced',
        'What happens to a rejected promise that nothing handles in Node 15 or later?',
        [
          'The process exits with an error',
          'It is silently ignored',
          'The promise is retried once',
          'Only a warning is printed',
        ],
        ['The process exits with an error'],
        'Since Node 15 an unhandled rejection is treated like an uncaught exception unless an unhandledRejection handler is installed.',
      ),
      q(
        'multi-select',
        'beginner',
        'Which of these are built-in Node.js modules?',
        ['fs', 'path', 'crypto', 'express'],
        ['fs', 'path', 'crypto'],
        'Express is a third-party package installed from npm.',
      ),
      q(
        'multi-select',
        'intermediate',
        'Which statements about Express 4 are true?',
        [
          'Middleware runs in the order it was registered',
          'Errors thrown in async handlers are forwarded automatically',
          'An error-handling middleware takes four parameters',
          'app.use without a path matches every request',
        ],
        [
          'Middleware runs in the order it was registered',
          'An error-handling middleware takes four parameters',
          'app.use without a path matches every request',
        ],
        'Express 4 does not catch rejected promises; wrap async handlers or call next(err) yourself.',
      ),
      tf(
        'beginner',
        'Node.js runs JavaScript on a single main thread and delegates I/O to libuv.',
        true,
        'That is why a long synchronous loop blocks every request.',
      ),
      tf(
        'beginner',
        'fs.readFileSync blocks the event loop until the whole file is read.',
        true,
        'Use the promise or callback variants on a server.',
      ),
      tf(
        'intermediate',
        'Requiring the same module twice runs its code twice.',
        false,
        'Modules are cached after the first load; both calls get the same exports object.',
      ),
    ],
  },
  {
    keys: ['typescript', 'ts'],
    questions: [
      q(
        'single-select',
        'beginner',
        'Which symbol marks an interface property as optional?',
        ['?', '!', '*', '~'],
        ['?'],
        'name?: string means the property may be missing.',
      ),
      q(
        'single-select',
        'intermediate',
        "What is the inferred type of x in const x = [1, 'a']?",
        ['(string | number)[]', '[number, string]', 'any[]', 'never[]'],
        ['(string | number)[]'],
        'Array literals infer a union element type, not a tuple, unless you add as const or a tuple annotation.',
      ),
      q(
        'single-select',
        'intermediate',
        'How does unknown differ from any?',
        [
          'A value of type unknown must be narrowed before it is used',
          'They behave identically',
          'unknown cannot hold objects',
          'any must be narrowed before it is used',
        ],
        ['A value of type unknown must be narrowed before it is used'],
        'unknown is the type-safe counterpart of any.',
      ),
      q(
        'single-select',
        'advanced',
        'What does keyof typeof obj produce?',
        [
          'A union of the property names of obj',
          'The type of the values of obj',
          'A tuple of the keys of obj',
          'The string type',
        ],
        ['A union of the property names of obj'],
        "typeof obj gives the object's type, keyof turns its keys into a string literal union.",
      ),
      q(
        'multi-select',
        'intermediate',
        'Which constructs exist only at compile time and produce no JavaScript?',
        ['interface', 'type alias', 'enum', 'class'],
        ['interface', 'type alias'],
        'A regular enum and a class compile to real JavaScript objects.',
      ),
      q(
        'multi-select',
        'beginner',
        'Which of these are primitive types in TypeScript?',
        ['string', 'number', 'boolean', 'object'],
        ['string', 'number', 'boolean'],
        'object is the non-primitive type.',
      ),
      tf('beginner', 'TypeScript type annotations are checked at runtime.', false, 'Types are erased by the compiler.'),
      tf(
        'intermediate',
        'With strictNullChecks on, null is not assignable to string.',
        true,
        'You have to write string | null to allow it.',
      ),
    ],
  },
  {
    keys: ['javascript', 'js', 'ecmascript', 'es6', 'frontend', 'browser'],
    questions: [
      q(
        'single-select',
        'beginner',
        'Which of these values is falsy?',
        ['"0" (a string)', '[]', '{}', 'NaN'],
        ['NaN'],
        'NaN is falsy. A non-empty string, an empty array and an empty object are all truthy.',
      ),
      q(
        'single-select',
        'intermediate',
        'What does [1, 2, 3].map(parseInt) return?',
        ['[1, 2, 3]', '[1, NaN, NaN]', '[NaN, NaN, NaN]', 'A TypeError'],
        ['[1, NaN, NaN]'],
        'map passes the index as the second argument, which parseInt takes as the radix: 0 falls back to 10, radix 1 is invalid and "3" is not a base-2 digit.',
      ),
      q(
        'single-select',
        'beginner',
        'What does 0.1 + 0.2 === 0.3 evaluate to?',
        ['true', 'false', 'undefined', 'It throws a RangeError'],
        ['false'],
        'Binary floating point cannot represent 0.1 and 0.2 exactly; the sum is 0.30000000000000004.',
      ),
      q(
        'single-select',
        'advanced',
        'Inside a regular function, what does typeof arguments return?',
        ['"object"', '"array"', '"arguments"', '"undefined"'],
        ['"object"'],
        'arguments is an array-like object, not an Array.',
      ),
      q(
        'multi-select',
        'intermediate',
        'Which array methods return a new array instead of changing the original?',
        ['map', 'filter', 'push', 'sort'],
        ['map', 'filter'],
        'push and sort mutate the array they are called on.',
      ),
      q(
        'multi-select',
        'intermediate',
        'Which callbacks run only after the current synchronous code has finished?',
        ['setTimeout(fn, 0)', 'Promise.then(fn)', 'queueMicrotask(fn)', 'A plain call fn()'],
        ['setTimeout(fn, 0)', 'Promise.then(fn)', 'queueMicrotask(fn)'],
        'Timers and microtasks are queued; a plain call runs immediately.',
      ),
      tf(
        'beginner',
        '== converts both operands to a common type before comparing them.',
        true,
        'Use === to compare without coercion.',
      ),
      tf(
        'intermediate',
        'Arrow functions have their own this binding.',
        false,
        'Arrow functions take this from the surrounding scope.',
      ),
      tf(
        'advanced',
        'Object.freeze makes nested objects immutable as well.',
        false,
        'freeze is shallow; properties of nested objects can still change.',
      ),
    ],
  },
  {
    keys: ['sql', 'postgres', 'postgresql', 'database', 'db', 'mysql', 'query', 'queries'],
    questions: [
      q(
        'single-select',
        'beginner',
        'Which JOIN keeps every row of the left table and fills missing right-side columns with NULL?',
        ['LEFT JOIN', 'INNER JOIN', 'RIGHT JOIN', 'CROSS JOIN'],
        ['LEFT JOIN'],
        'INNER JOIN drops rows without a match; RIGHT JOIN keeps the right table instead.',
      ),
      q(
        'single-select',
        'beginner',
        'Which clause filters the groups produced by GROUP BY?',
        ['HAVING', 'WHERE', 'FILTER', 'LIMIT'],
        ['HAVING'],
        'WHERE runs before grouping, HAVING after.',
      ),
      q(
        'single-select',
        'intermediate',
        'What does COUNT(email) count?',
        ['Rows where email is not NULL', 'All rows', 'Distinct emails', 'Rows where email is NULL'],
        ['Rows where email is not NULL'],
        'COUNT(*) counts every row; COUNT(column) skips NULLs.',
      ),
      q(
        'single-select',
        'advanced',
        'Which window function gives ties the same number without leaving gaps afterwards?',
        ['dense_rank()', 'rank()', 'row_number()', 'ntile()'],
        ['dense_rank()'],
        'rank() leaves gaps after ties, row_number() never ties.',
      ),
      q(
        'multi-select',
        'intermediate',
        'Which of these are the ACID properties of a transaction?',
        ['Atomicity', 'Consistency', 'Isolation', 'Availability'],
        ['Atomicity', 'Consistency', 'Isolation'],
        'The fourth one is Durability; availability belongs to the CAP theorem.',
      ),
      q(
        'multi-select',
        'intermediate',
        'Which statements about indexes are true?',
        [
          'They speed up lookups on the indexed columns',
          'They make inserts and updates a little slower',
          'A UNIQUE constraint creates an index',
          'They are only refreshed when VACUUM runs',
        ],
        [
          'They speed up lookups on the indexed columns',
          'They make inserts and updates a little slower',
          'A UNIQUE constraint creates an index',
        ],
        'Indexes are maintained on every write, not by VACUUM.',
      ),
      tf('beginner', 'A PRIMARY KEY column can contain NULL values.', false, 'A primary key is NOT NULL and UNIQUE.'),
      tf(
        'advanced',
        'SELECT ... FOR UPDATE locks the selected rows until the transaction ends.',
        true,
        'Other transactions trying to lock the same rows wait, which is how a double submit is prevented.',
      ),
      tf(
        'intermediate',
        'DELETE without a WHERE clause removes every row in the table.',
        true,
        'TRUNCATE does the same faster, without row-level logging.',
      ),
    ],
  },
  {
    keys: ['python', 'django', 'flask'],
    questions: [
      q(
        'single-select',
        'beginner',
        'What does len({}) return?',
        ['0', '1', 'None', 'It raises TypeError'],
        ['0'],
        '{} is an empty dict.',
      ),
      q(
        'single-select',
        'beginner',
        'Which built-in type does not allow duplicate elements?',
        ['set', 'list', 'tuple', 'str'],
        ['set'],
        'Sets store unique, hashable values.',
      ),
      q(
        'single-select',
        'intermediate',
        'What does 3 / 2 evaluate to in Python 3?',
        ['1.5', '1', '2', 'It raises TypeError'],
        ['1.5'],
        '/ is true division; use // for floor division.',
      ),
      q(
        'single-select',
        'intermediate',
        'What does a function without a return statement return?',
        ['None', '0', 'False', 'An empty string'],
        ['None'],
        'Every function returns None unless it returns something else.',
      ),
      q(
        'multi-select',
        'intermediate',
        'Which of these types are immutable?',
        ['tuple', 'str', 'list', 'dict'],
        ['tuple', 'str'],
        'Lists and dicts can be changed in place.',
      ),
      q(
        'multi-select',
        'beginner',
        'Which keywords start a block that must be indented?',
        ['def', 'class', 'while', 'then'],
        ['def', 'class', 'while'],
        'then is not a Python keyword.',
      ),
      tf('beginner', 'Python uses indentation to define code blocks.', true, 'Braces are not used for blocks.'),
      tf(
        'advanced',
        'def f(x=[]) creates a fresh empty list every time f is called without an argument.',
        false,
        'Default values are evaluated once, when the function is defined, so the list is shared between calls.',
      ),
    ],
  },
];

// used when the topic matches none of the banks above
const general: BankQuestion[] = [
  q(
    'single-select',
    'beginner',
    'What is the time complexity of binary search on a sorted array of n items?',
    ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'],
    ['O(log n)'],
    'Each step halves the remaining range.',
  ),
  q(
    'single-select',
    'beginner',
    'Which HTTP status code means the request needs authentication?',
    ['401', '403', '404', '500'],
    ['401'],
    '403 means the caller is known but not allowed.',
  ),
  q(
    'single-select',
    'intermediate',
    'Which HTTP method is defined as idempotent?',
    ['PUT', 'POST', 'PATCH', 'CONNECT'],
    ['PUT'],
    'Repeating a PUT leaves the resource in the same state; POST and PATCH make no such promise.',
  ),
  q(
    'single-select',
    'advanced',
    'What does a 409 Conflict status usually indicate?',
    [
      'The request clashes with the current state of the resource',
      'The server is overloaded',
      'The client sent malformed JSON',
      'The resource has moved',
    ],
    ['The request clashes with the current state of the resource'],
    'Typical cases: duplicate registration or submitting twice.',
  ),
  q(
    'multi-select',
    'beginner',
    'Which of these are HTTP methods?',
    ['GET', 'DELETE', 'OPTIONS', 'FETCH'],
    ['GET', 'DELETE', 'OPTIONS'],
    'fetch is a browser API, not a method.',
  ),
  q(
    'multi-select',
    'intermediate',
    'Which statements describe a stack?',
    [
      'Last in, first out',
      'Elements are added and removed with push and pop',
      'First in, first out',
      'Elements are added with enqueue',
    ],
    ['Last in, first out', 'Elements are added and removed with push and pop'],
    'First in, first out and enqueue describe a queue.',
  ),
  tf('beginner', 'In JSON, object keys must be strings.', true, 'Numbers or identifiers as keys are invalid JSON.'),
  tf(
    'intermediate',
    'HTTP is a stateful protocol.',
    false,
    'Each request stands alone; sessions are built on top with cookies or tokens.',
  ),
  tf('advanced', 'A hash table has O(1) average-case lookup.', true, 'Worst case degrades with many collisions.'),
];

export function bankFor(topic: string): BankQuestion[] {
  const words = topic
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter(Boolean);
  const hit = topics.find((t) => t.keys.some((k) => words.includes(k)));
  return hit ? hit.questions : general;
}
