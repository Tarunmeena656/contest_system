import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

export default function setup() {
  const env = { ...process.env, ...dotenv.parse(readFileSync('.env.test')) };
  execSync('npx knex migrate:latest', { env, stdio: 'inherit' });
}
