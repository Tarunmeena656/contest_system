exports.up = async function (knex) {
  await knex.raw(`create type user_role as enum ('user', 'vip', 'admin')`);
  await knex.raw(`create type contest_access as enum ('normal', 'vip')`);
  await knex.raw(`create type contest_difficulty as enum ('beginner', 'intermediate', 'advanced')`);
  await knex.raw(`create type question_type as enum ('single-select', 'multi-select', 'true-false')`);

  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 100).notNullable();
    t.string('email', 255).notNullable().unique();
    t.string('password_hash', 100).notNullable();
    t.specificType('role', 'user_role').notNullable().defaultTo('user');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('contests', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('name', 200).notNullable();
    t.text('description').notNullable().defaultTo('');
    t.specificType('access_level', 'contest_access').notNullable().defaultTo('normal');
    t.specificType('difficulty', 'contest_difficulty').notNullable().defaultTo('intermediate');
    t.specificType('tags', 'text[]').notNullable().defaultTo('{}');
    t.string('prize', 300);
    t.timestamp('start_time', { useTz: true }).notNullable();
    t.timestamp('end_time', { useTz: true }).notNullable();
    t.uuid('created_by').references('users.id').onDelete('set null');
    t.timestamp('finalized_at', { useTz: true });
    t.uuid('winner_user_id').references('users.id').onDelete('set null');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.check('end_time > start_time', [], 'contests_time_range');
    t.index(['start_time', 'end_time']);
    t.index(['access_level']);
  });
  // full-text search over name + description + tags, kept up to date by postgres itself
  // (array_to_string is not immutable, array_to_tsvector is, hence the concatenation)
  await knex.raw(`
    alter table contests add column search_vector tsvector
      generated always as (
        to_tsvector('english', name || ' ' || description) || array_to_tsvector(tags)
      ) stored
  `);
  await knex.raw(`create index contests_search_idx on contests using gin (search_vector)`);
  await knex.raw(`create index contests_tags_idx on contests using gin (tags)`);

  await knex.schema.createTable('questions', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('contest_id').notNullable().references('contests.id').onDelete('cascade');
    t.specificType('type', 'question_type').notNullable();
    t.text('text').notNullable();
    t.jsonb('options').notNullable();
    t.jsonb('correct_answers').notNullable();
    t.text('explanation');
    t.integer('points').notNullable().defaultTo(1);
    t.integer('position').notNullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.check('points > 0', [], 'questions_points_positive');
    t.unique(['contest_id', 'position']);
  });

  await knex.schema.createTable('participations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('contest_id').notNullable().references('contests.id').onDelete('cascade');
    t.uuid('user_id').notNullable().references('users.id').onDelete('cascade');
    t.timestamp('joined_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('submitted_at', { useTz: true });
    t.integer('score');
    t.unique(['contest_id', 'user_id']);
    t.index(['user_id', 'joined_at']);
  });
  // the leaderboard query: ranked by score, earlier submission wins ties
  await knex.raw(`
    create index participations_leaderboard_idx
      on participations (contest_id, score desc, submitted_at asc)
      where submitted_at is not null
  `);

  await knex.schema.createTable('answers', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('participation_id').notNullable().references('participations.id').onDelete('cascade');
    t.uuid('question_id').notNullable().references('questions.id').onDelete('cascade');
    t.jsonb('selected').notNullable();
    t.boolean('is_correct').notNullable();
    t.unique(['participation_id', 'question_id']);
  });

  await knex.schema.createTable('prizes', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('contest_id').notNullable().unique().references('contests.id').onDelete('cascade');
    t.uuid('user_id').notNullable().references('users.id').onDelete('cascade');
    t.string('prize', 300).notNullable();
    t.timestamp('awarded_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['user_id']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('prizes');
  await knex.schema.dropTableIfExists('answers');
  await knex.schema.dropTableIfExists('participations');
  await knex.schema.dropTableIfExists('questions');
  await knex.schema.dropTableIfExists('contests');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('drop type if exists question_type');
  await knex.raw('drop type if exists contest_difficulty');
  await knex.raw('drop type if exists contest_access');
  await knex.raw('drop type if exists user_role');
};
