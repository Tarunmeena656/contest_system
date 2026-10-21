import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

function num(name: string, fallback: number): number {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : Number(value);
}

const apiKey = process.env.ANTHROPIC_API_KEY ?? '';

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: num('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  ai: {
    provider: process.env.AI_PROVIDER ?? (apiKey ? 'anthropic' : 'mock'),
    apiKey,
    model: process.env.AI_MODEL ?? 'claude-opus-5-5',
  },
  finalizerIntervalMs: num('FINALIZER_INTERVAL_MS', 60_000),
  rateLimit: {
    windowMs: num('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: num('RATE_LIMIT_MAX', 300),
    authMax: num('RATE_LIMIT_AUTH_MAX', 20),
    aiMax: num('RATE_LIMIT_AI_MAX', 10),
  },
};
