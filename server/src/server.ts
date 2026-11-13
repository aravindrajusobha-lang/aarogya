import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initAgenda, stopAgenda } from './config/agenda.js';
import { logger } from './config/logger.js';
import { ensureStorageDirectory } from './modules/storage/storageService.js';
import { runMasterSeed } from './modules/seed/masterSeed.js';
import { backfillDoctorCodes } from './modules/doctorAdmin/doctorCodeService.js';
import { migrateAppointmentSlotIndex } from './modules/appointment/appointmentIndexMigration.js';
import { startConsultationScheduler, stopConsultationScheduler } from './modules/consultation/consultationScheduler.js';
import { attachConsultationSocket } from './modules/consultation/consultationSocket.js';

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    await ensureStorageDirectory();
    const conn = await connectDatabase();
    await runMasterSeed();
    await migrateAppointmentSlotIndex();
    await backfillDoctorCodes().catch((err) => logger.warn({ err: (err as Error).message }, 'Doctor ID backfill skipped'));
    await initAgenda({ mongoConnection: conn });
    startConsultationScheduler();

    const app = createApp();

    const server = createServer(app);
    const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
      .split(',').map((origin) => { try { return new URL(origin.trim()).origin; } catch { return ''; } }).filter(Boolean);
    attachConsultationSocket(server, allowedOrigins);
    server.listen(PORT, () => {
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
        stopConsultationScheduler();
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
