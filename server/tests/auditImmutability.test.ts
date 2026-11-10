import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { AuditLog } from '../src/modules/audit/auditModel.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Append-Only Audit Log Immutability & Mutation Rejection', () => {
  let replSet: MongoMemoryReplSet;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsAudit');
    await mongoose.connect(replSet.getUri());
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('allows appending new immutable audit log records', async () => {
    const entry = await AuditLog.create({
      action: 'USER_LOGIN_SUCCESS',
      actorId: 'user_asha_001',
      actorRole: 'asha',
      resourceType: 'auth',
      resourceId: 'session_9921',
      ip: '192.168.1.50',
      userAgent: 'Aarogya-PWA/Android',
      statusCode: 200,
      metadata: { clinicId: 'phc_paderu_01' },
      simulation: true,
    });

    expect(entry._id).toBeDefined();
    expect(entry.action).toBe('USER_LOGIN_SUCCESS');
    expect(entry.simulation).toBe(true);

    const fetched = await AuditLog.findById(entry._id);
    expect(fetched).toBeDefined();
    expect(fetched?.actorId).toBe('user_asha_001');
  });

  it('strictly rejects updateOne on AuditLog documents', async () => {
    await expect(
      AuditLog.updateOne({ action: 'USER_LOGIN_SUCCESS' }, { $set: { action: 'TAMPERED_ACTION' } })
    ).rejects.toThrow('AuditLog is append-only: updates and deletions are strictly prohibited');
  });

  it('strictly rejects updateMany on AuditLog documents', async () => {
    await expect(
      AuditLog.updateMany({}, { $set: { actorRole: 'system_admin' } })
    ).rejects.toThrow('AuditLog is append-only: updates and deletions are strictly prohibited');
  });

  it('strictly rejects findOneAndUpdate on AuditLog documents', async () => {
    await expect(
      AuditLog.findOneAndUpdate({ action: 'USER_LOGIN_SUCCESS' }, { $set: { statusCode: 500 } })
    ).rejects.toThrow('AuditLog is append-only: updates and deletions are strictly prohibited');
  });

  it('strictly rejects replaceOne on AuditLog documents', async () => {
    await expect(
      AuditLog.replaceOne(
        { action: 'USER_LOGIN_SUCCESS' },
        {
          action: 'OVERWRITTEN',
          ip: '0.0.0.0',
          statusCode: 200,
          simulation: true,
        }
      )
    ).rejects.toThrow('AuditLog is append-only: updates and deletions are strictly prohibited');
  });

  it('strictly rejects deleteOne on AuditLog collection', async () => {
    await expect(
      AuditLog.deleteOne({ action: 'USER_LOGIN_SUCCESS' })
    ).rejects.toThrow('AuditLog is append-only: updates and deletions are strictly prohibited');
  });

  it('strictly rejects deleteMany on AuditLog collection', async () => {
    await expect(
      AuditLog.deleteMany({})
    ).rejects.toThrow('AuditLog is append-only: updates and deletions are strictly prohibited');
  });

  it('strictly rejects findOneAndDelete on AuditLog collection', async () => {
    await expect(
      AuditLog.findOneAndDelete({ action: 'USER_LOGIN_SUCCESS' })
    ).rejects.toThrow('AuditLog is append-only: updates and deletions are strictly prohibited');
  });

  it('strictly rejects document-level .deleteOne()', async () => {
    const record = await AuditLog.findOne({ action: 'USER_LOGIN_SUCCESS' });
    expect(record).toBeDefined();

    await expect(record!.deleteOne()).rejects.toThrow(
      'AuditLog is append-only: updates and deletions are strictly prohibited'
    );
  });

  it('strictly rejects document-level modifications and .save()', async () => {
    const record = await AuditLog.findOne({ action: 'USER_LOGIN_SUCCESS' });
    expect(record).toBeDefined();

    record!.action = 'MODIFIED_IN_MEMORY';
    await expect(record!.save()).rejects.toThrow(
      'AuditLog is append-only: existing entries cannot be updated'
    );
  });
});
