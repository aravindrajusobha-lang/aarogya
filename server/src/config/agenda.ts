import { Agenda, Job } from 'agenda';
import mongoose from 'mongoose';
import { logger } from './logger.js';

export interface RetryJobData {
  attempts?: number;
  maxRetries?: number;
  backoffFactorMs?: number;
  [key: string]: unknown;
}

let agendaInstance: Agenda | null = null;

export function getAgenda(): Agenda {
  if (!agendaInstance) {
    throw new Error('Agenda scheduler has not been initialized');
  }
  return agendaInstance;
}

export interface AgendaConfigOptions {
  mongoConnection?: mongoose.Connection;
  dbUri?: string;
  collectionName?: string;
  processEvery?: string;
  defaultLockLifetimeMs?: number;
  maxConcurrency?: number;
}

export async function initAgenda(options: AgendaConfigOptions = {}): Promise<Agenda> {
  if (agendaInstance) {
    return agendaInstance;
  }

  const collectionName = options.collectionName || 'agenda_jobs';
  const lockLifetime = options.defaultLockLifetimeMs || 10000; // 10 seconds lock
  const processEvery = options.processEvery || '5 seconds';

  const mongoUri = options.dbUri || process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aarogya_drishti';

  const agenda = new Agenda({
    db: { address: mongoUri, collection: collectionName },
    processEvery,
    defaultLockLifetime: lockLifetime,
    maxConcurrency: options.maxConcurrency || 20,
    defaultConcurrency: 5,
  });

  // Register Event Listeners for telemetry & audit
  agenda.on('start', (job: Job) => {
    logger.info({
      event: 'agenda_job_start',
      jobName: job.attrs.name,
      jobId: job.attrs._id,
      lockedAt: job.attrs.lockedAt,
    });
  });

  agenda.on('complete', (job: Job) => {
    logger.info({
      event: 'agenda_job_complete',
      jobName: job.attrs.name,
      jobId: job.attrs._id,
      lastFinishedAt: job.attrs.lastFinishedAt,
    });
  });

  agenda.on('fail', (err: Error, job: Job) => {
    logger.error({
      event: 'agenda_job_failed',
      jobName: job.attrs.name,
      jobId: job.attrs._id,
      error: err.message,
      failedAt: job.attrs.failedAt,
    });
  });

  // Define Standard Scheduled Job: Heartbeat & Health Check
  agenda.define('simulation:heartbeat', async (job: Job) => {
    logger.info({
      event: 'simulation_scheduler_heartbeat',
      jobId: job.attrs._id,
      timestamp: new Date().toISOString(),
      simulation: true,
    });
  });

  // Define Job with Exponential Backoff Support: Patient Follow-up Navigation Reminder
  agenda.define('referral:navigation_reminder', async (job: Job<RetryJobData>) => {
    const data = job.attrs.data || {};
    const attempts = (data.attempts || 0) + 1;
    const maxRetries = data.maxRetries ?? 3;
    const backoffFactorMs = data.backoffFactorMs ?? 2000;

    data.attempts = attempts;
    job.attrs.data = data;

    try {
      logger.info({
        event: 'navigation_reminder_attempt',
        jobId: job.attrs._id,
        attempts,
        maxRetries,
        simulation: true,
      });

      // Simulation task execution (e.g. queue mock SMS reminder to ASHA/patient)
      if (data.simulateFailure && attempts < 2) {
        throw new Error('Simulated gateway timeout during SMS dispatch');
      }

      // Success
      logger.info({
        event: 'navigation_reminder_dispatched',
        jobId: job.attrs._id,
        status: 'MOCK_DISPATCHED',
      });
    } catch (error) {
      if (attempts < maxRetries) {
        const nextDelayMs = backoffFactorMs * Math.pow(2, attempts - 1);
        job.schedule(new Date(Date.now() + nextDelayMs));
        await job.save();
        logger.warn({
          event: 'navigation_reminder_retry_scheduled',
          jobId: job.attrs._id,
          nextAttemptInMs: nextDelayMs,
        });
      }
      throw error;
    }
  });

  await agenda.start();
  logger.info({
    event: 'agenda_scheduler_started',
    collection: collectionName,
    lockLifetimeMs: lockLifetime,
  });

  agendaInstance = agenda;
  return agenda;
}

export async function stopAgenda(): Promise<void> {
  if (agendaInstance) {
    await agendaInstance.stop();
    logger.info({ event: 'agenda_scheduler_stopped' });
    agendaInstance = null;
  }
}
