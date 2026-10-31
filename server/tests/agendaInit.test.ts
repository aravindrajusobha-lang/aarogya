import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { initAgenda, getAgenda, stopAgenda } from '../src/config/agenda.js';
import { createTestReplicaSet } from './setupReplSet.js';
import { getTranslation } from '../src/i18n/index.js';

describe('Agenda Lifecycle & i18n Translation Helper', () => {
  let replSet: MongoMemoryReplSet;
  let agendaDbUri: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsAgendaInit');
    const rawUri = replSet.getUri();
    agendaDbUri = rawUri.includes('?') ? rawUri.replace('/?', '/agenda_init_db?') : `${rawUri}agenda_init_db`;
    await mongoose.connect(agendaDbUri);
  }, 60000);

  afterAll(async () => {
    await stopAgenda();
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('initializes Agenda instance and provides singleton access', async () => {
    const agenda = await initAgenda({
      dbUri: agendaDbUri,
      collectionName: 'agenda_lifecycle_jobs',
      processEvery: '1 second',
    });

    expect(agenda).toBeDefined();
    expect(getAgenda()).toBe(agenda);
  });

  it('resolves server-side translations with fallback', () => {
    const enTitle = getTranslation('app.title', 'en');
    expect(enTitle).toBe('Aarogya Drishti');

    const teTitle = getTranslation('app.title', 'te');
    expect(teTitle).toBe('ఆరోగ్య దృష్టి');

    const hiTitle = getTranslation('app.title', 'hi');
    expect(hiTitle).toBe('आरोग्य दृष्टि');

    const nonExistentKey = getTranslation('non.existent.path', 'en');
    expect(nonExistentKey).toBe('non.existent.path');
  });
});
