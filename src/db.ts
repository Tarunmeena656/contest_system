import knex from 'knex';
import { config } from './config';

export const db = knex({
  client: 'pg',
  connection: config.databaseUrl,
  pool: { min: 0, max: 10 },
});
