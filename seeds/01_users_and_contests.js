const bcrypt = require('bcryptjs');

const day = 24 * 60 * 60 * 1000;

exports.seed = async function (knex) {
  const existing = await knex('users').where({ email: 'admin@contest.dev' }).first();
  if (existing) {
    console.log('seed data already present, skipping');
    return;
  }

  const [admin, vip, user] = await knex('users')
    .insert([
      { name: 'Admin', email: 'admin@contest.dev', password_hash: await bcrypt.hash('Admin123!', 10), role: 'admin' },
      { name: 'Vera VIP', email: 'vip@contest.dev', password_hash: await bcrypt.hash('Vip12345!', 10), role: 'vip' },
      { name: 'Normal Nick', email: 'user@contest.dev', password_hash: await bcrypt.hash('User1234!', 10), role: 'user' },
    ])
    .returning('*');

  const now = Date.now();
  const [js, node, sql] = await knex('contests')
    .insert([
      {
        name: 'JavaScript Basics',
        description: 'Warm-up quiz on core JavaScript: types, scope, closures and arrays.',
        access_level: 'normal',
        difficulty: 'beginner',
        tags: ['javascript', 'frontend'],
        prize: 'Rs 1,000 Amazon voucher',
        start_time: new Date(now - 1 * day),
        end_time: new Date(now + 6 * day),
        created_by: admin.id,
      },
      {
        name: 'Node.js Backend Challenge',
        description: 'Event loop, streams, clustering and production patterns for Node.js services.',
        access_level: 'vip',
        difficulty: 'advanced',
        tags: ['node.js', 'backend'],
        prize: 'Mechanical keyboard',
        start_time: new Date(now - 1 * day),
        end_time: new Date(now + 3 * day),
        created_by: admin.id,
      },
      {
        name: 'SQL Weekend Sprint',
        description: 'Joins, window functions and indexing on PostgreSQL.',
        access_level: 'normal',
        difficulty: 'intermediate',
        tags: ['sql', 'postgresql', 'backend'],
        prize: 'Rs 500 voucher',
        start_time: new Date(now + 5 * day),
        end_time: new Date(now + 7 * day),
        created_by: admin.id,
      },
      {
        name: 'TypeScript Types Quiz',
        description: 'Generics, narrowing and utility types. This one already finished.',
        access_level: 'normal',
        difficulty: 'intermediate',
        tags: ['typescript'],
        prize: null,
        start_time: new Date(now - 10 * day),
        end_time: new Date(now - 3 * day),
        created_by: admin.id,
      },
    ])
    .returning('*');

  const q = (contest_id, position, type, text, options, correct_answers, explanation) => ({
    contest_id,
    position,
    type,
    text,
    options: JSON.stringify(options),
    correct_answers: JSON.stringify(correct_answers),
    explanation,
  });

  await knex('questions').insert([
    q(js.id, 1, 'single-select', 'What does typeof null return?', ['"null"', '"object"', '"undefined"', '"number"'], ['"object"'], 'A long-standing quirk of the language.'),
    q(js.id, 2, 'multi-select', 'Which of these are primitive types?', ['String', 'Number', 'Array', 'Symbol'], ['String', 'Number', 'Symbol'], 'Array is an object.'),
    q(js.id, 3, 'true-false', 'const prevents reassignment but not mutation of objects.', ['True', 'False'], ['True'], 'const binds the name, not the value.'),
    q(js.id, 4, 'single-select', 'Which method adds an element to the end of an array?', ['push', 'pop', 'shift', 'unshift'], ['push'], null),
    q(node.id, 1, 'single-select', 'Which phase of the event loop runs setImmediate callbacks?', ['timers', 'poll', 'check', 'close callbacks'], ['check'], null),
    q(node.id, 2, 'multi-select', 'Which of these are readable stream events?', ['data', 'end', 'drain', 'error'], ['data', 'end', 'error'], 'drain is emitted by writable streams.'),
    q(node.id, 3, 'true-false', 'process.nextTick callbacks run before promise microtasks.', ['True', 'False'], ['True'], null),
    q(sql.id, 1, 'single-select', 'Which window function gives the same rank to ties and leaves gaps?', ['row_number', 'rank', 'dense_rank', 'ntile'], ['rank'], null),
  ]);

  // the vip already played the javascript contest, the normal user joined but has not submitted
  const [vipRun] = await knex('participations')
    .insert({
      contest_id: js.id,
      user_id: vip.id,
      joined_at: new Date(now - 12 * 60 * 60 * 1000),
      submitted_at: new Date(now - 11 * 60 * 60 * 1000),
      score: 3,
    })
    .returning('*');
  const jsQuestions = await knex('questions').where({ contest_id: js.id }).orderBy('position');
  await knex('answers').insert(
    jsQuestions.map((question, i) => ({
      participation_id: vipRun.id,
      question_id: question.id,
      selected: JSON.stringify(i === 3 ? ['pop'] : question.correct_answers),
      is_correct: i !== 3,
    })),
  );
  await knex('participations').insert({ contest_id: js.id, user_id: user.id });

  console.log('seeded admin@contest.dev / Admin123!, vip@contest.dev / Vip12345!, user@contest.dev / User1234!');
};
