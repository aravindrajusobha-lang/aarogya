import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initAgenda, stopAgenda } from './config/agenda.js';
import { logger } from './config/logger.js';
import { ensureStorageDirectory } from './modules/storage/storageService.js';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await ensureStorageDirectory();
    const conn = await connectDatabase();
    await initAgenda({ mongoConnection: conn });

    const app = createApp();

    const server = app.listen(PORT, () => {
      logger.info({
        event: 'server_listening',
        port: PORT,
        env: process.env.NODE_ENV || 'simulation-demo',
        simulationNotice: 'Aarogya Drishti Simulation Server Online (ITDA Paderu)',
      });
    });

    const shutdown = async (signal: string) => {
      logger.info({ event: 'server_shutdown_initiated', signal });
      server.close(async () => {
        await stopAgenda();
        await disconnectDatabase();
        logger.info({ event: 'server_shutdown_complete' });
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({
      event: 'server_bootstrap_fatal_error',
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
