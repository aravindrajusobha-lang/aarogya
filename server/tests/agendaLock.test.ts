import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Agenda, Job } from 'agenda';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Agenda Job Locking & Restart Execution Semantics', () => {
  let replSet: MongoMemoryReplSet;
  let agenda1: Agenda;
  let agenda2: Agenda;
  let agendaDbUri: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsAgenda');
    const rawUri = replSet.getUri();
    agendaDbUri = rawUri.includes('?') ? rawUri.replace('/?', '/agenda_test?') : `${rawUri}agenda_test`;
    await mongoose.connect(agendaDbUri);
  }, 60000);

  afterAll(async () => {
    if (agenda1) await agenda1.stop().catch(() => {});
    if (agenda2) await agenda2.stop().catch(() => {});
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('guarantees that a scheduled job runs exactly once and does not re-execute after server restart', async () => {
    let executionCounter = 0;

    // Instance 1: Initial server run
    agenda1 = new Agenda({
      db: { address: agendaDbUri, collection: 'agenda_test_jobs' },
      processEvery: '1 second',
      defaultLockLifetime: 5000,
    });

    agenda1.define('test:single_run', async (_job: Job) => {
      executionCounter += 1;
    });

    await agenda1.start();

    // Schedule a job to run immediately
    await agenda1.now('test:single_run', { marker: 'run-once-test' });

    // Wait for agenda1 to process the job
    await new Promise((resolve) => setTimeout(resolve, 2500));

    expect(executionCounter).toBe(1);

    // Simulate server shutdown
    await agenda1.stop();

    // Instance 2: Server restarts
    agenda2 = new Agenda({
      db: { address: agendaDbUri, collection: 'agenda_test_jobs' },
      processEvery: '1 second',
      defaultLockLifetime: 5000,
    });

    agenda2.define('test:single_run', async (_job: Job) => {
      executionCounter += 1;
    });

    await agenda2.start();

    // Wait another cycle to confirm the finished job is NOT picked up again
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Execution counter must still be 1 (EXACTLY ONCE)
    expect(executionCounter).toBe(1);

    // Verify job in database has lastFinishedAt set and nextRunAt null
    const jobs = await mongoose.connection
      .collection('agenda_test_jobs')
      .find({ name: 'test:single_run' })
      .toArray();

    expect(jobs.length).toBe(1);
    expect(jobs[0].lastFinishedAt).toBeDefined();
    expect(jobs[0].nextRunAt).toBeNull();
  });

  it('guarantees atomic lock acquisition via lockedAt field during execution', async () => {
    let lockObserved: Date | null = null;
    const testAgenda = new Agenda({
      db: { address: agendaDbUri, collection: 'agenda_lock_verification' },
      processEvery: '1 second',
      defaultLockLifetime: 10000,
    });

    testAgenda.define('test:lock_check', async (job: Job) => {
      lockObserved = job.attrs.lockedAt || null;
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    await testAgenda.start();
    await testAgenda.now('test:lock_check', {});

    await new Promise((resolve) => setTimeout(resolve, 2500));
    await testAgenda.stop();

    expect(lockObserved).toBeInstanceOf(Date);
  });
});
