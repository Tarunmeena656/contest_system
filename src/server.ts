import { app } from './app';
import { config } from './config';
import { db } from './db';
import { logger } from './logger';
import { startFinalizer } from './services/finalize';

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'api listening');
});

const stopFinalizer = startFinalizer(config.finalizerIntervalMs);

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  stopFinalizer();
  server.close(async () => {
    await db.destroy();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
