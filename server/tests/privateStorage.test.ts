import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { AuditLog } from '../src/modules/audit/auditModel.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Private File Storage Access & Scope Authorization Guard', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();
  let uploadedFileId: string;
  const dummyFileContent = Buffer.from('SIMULATED_ORAL_CAVITY_IMAGE_BYTES_12345');

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsStorage');
    await mongoose.connect(replSet.getUri());
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('rejects unauthenticated file upload with 401', async () => {
    const res = await request(app)
      .post('/api/v1/storage/upload')
      .attach('file', dummyFileContent, 'oral_mucosa_demo.png');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('allows authorized health worker to upload clinical demo image', async () => {
    const res = await request(app)
      .post('/api/v1/storage/upload')
      .set('Authorization', 'Bearer sim_user_asha_001')
      .attach('file', dummyFileContent, 'oral_mucosa_demo.png');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fileId).toBeDefined();
    expect(res.body.data.mimeType).toBe('image/png');
    expect(res.body.data.accessEndpoint).toContain(res.body.data.fileId);

    uploadedFileId = res.body.data.fileId;
  });

  it('strictly rejects unauthenticated access to clinical file (no public URLs)', async () => {
    const res = await request(app).get(`/api/v1/storage/files/${uploadedFileId}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('strictly rejects access if user lacks required scope (e.g. unverified patient)', async () => {
    const res = await request(app)
      .get(`/api/v1/storage/files/${uploadedFileId}`)
      .set('Authorization', 'Bearer sim_user_patient_001');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('serves file stream to authorized Medical Officer with strict security headers', async () => {
    const res = await request(app)
      .get(`/api/v1/storage/files/${uploadedFileId}`)
      .set('Authorization', 'Bearer sim_user_medical_officer_phc01');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-disposition']).toContain('oral_mucosa_demo.png');
    expect(res.headers['x-simulation-data']).toBe('true');
    expect(res.body).toEqual(dummyFileContent);

    // Wait briefly for on('finish') event to write audit entry before asserting
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify audit log entry was created
    const auditRecord = await AuditLog.findOne({
      action: 'STORAGE_FILE_READ',
      resourceId: uploadedFileId,
    });
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.simulation).toBe(true);
  });
});
