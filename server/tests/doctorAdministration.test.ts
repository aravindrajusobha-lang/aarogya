import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/auth/userModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { savePrivateFile } from '../src/modules/storage/storageService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { backfillDoctorCodes } from '../src/modules/doctorAdmin/doctorCodeService.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Admin doctor onboarding: unique Doctor ID, credentials, verification', () => {
  let replSet: MongoMemoryReplSet;
  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let sysToken: string;
  let doctorToken: string;
  let documentId: string;

  const payload = (overrides: Record<string, unknown> = {}) => ({
    hospitalId: 'hosp_admin_a',
    fullName: 'Dr. Synthetic Rao',
    phone: '+919000000001',
    email: 'synthetic.doctor@example.org',
    department: 'oral_medicine_radiology',
    qualifications: ['BDS', 'MDS'],
    experienceYears: 8,
    consultationFee: 200,
    languages: ['Telugu', 'English'],
    consultationModes: ['online', 'offline'],
    councilName: 'Andhra Pradesh State Dental Council',
    councilRegistrationNumber: `APSDC-${Math.floor(Math.random() * 1e6)}`,
    qualificationDocumentId: documentId,
    ...overrides,
  });

  beforeAll(async () => {
    vi.stubEnv('GCS_BUCKET_NAME', '');
    replSet = await createTestReplicaSet('rsDoctorAdmin');
    await mongoose.connect(replSet.getUri());
    app = createApp();
    await Hospital.create([
      { hospitalId: 'hosp_admin_a', name: 'Facility A', type: 'district_hospital', district: 'ASR', mandal: 'Paderu' },
      { hospitalId: 'hosp_admin_b', name: 'Facility B', type: 'community_health_centre', district: 'ASR', mandal: 'Araku' },
    ]);
    await User.create([
      { userId: 'adm_a', username: 'adm_a', fullName: 'Admin A', role: 'admin', hospitalId: 'hosp_admin_a', passwordHash: 'x', status: 'active' },
      { userId: 'sys_1', username: 'sys_1', fullName: 'System Admin', role: 'system_admin', passwordHash: 'x', status: 'active' },
      { userId: 'legacy_doc', username: 'legacy_doc', fullName: 'Legacy Doctor', role: 'medical_officer', hospitalId: 'hosp_admin_a', passwordHash: 'x', status: 'active', verificationStatus: 'verified' },
    ]);
    adminToken = signAccessToken({ userId: 'adm_a', role: 'admin', hospitalId: 'hosp_admin_a', scopes: getRoleCapabilities('admin') });
    sysToken = signAccessToken({ userId: 'sys_1', role: 'system_admin', scopes: getRoleCapabilities('system_admin') });
    doctorToken = signAccessToken({ userId: 'legacy_doc', role: 'medical_officer', hospitalId: 'hosp_admin_a', scopes: getRoleCapabilities('medical_officer') });
    const stored = await savePrivateFile({ originalFilename: 'degree.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-synthetic'), uploader: { id: 'adm_a', role: 'admin', hospitalId: 'hosp_admin_a' } as any, category: 'doctors/qualifications', hospitalId: 'hosp_admin_a' });
    documentId = stored.fileId;
  }, 60000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('gives existing doctors a unique Doctor ID (idempotent backfill)', async () => {
    expect(await backfillDoctorCodes()).toBe(1);
    expect(await backfillDoctorCodes()).toBe(0);
    const legacy: any = await User.findOne({ userId: 'legacy_doc' }).lean();
    expect(legacy.doctorCode).toMatch(/^AD-DR-\d{5}$/);
  });

  it('returns reference lists and only the admin’s own facility', async () => {
    const res = await request(app).get('/api/v1/admin/doctors/reference').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.facilities.map((f: any) => f.hospitalId)).toEqual(['hosp_admin_a']);
    expect(res.body.data.departments.length).toBeGreaterThanOrEqual(10);
    const sys = await request(app).get('/api/v1/admin/doctors/reference').set('Authorization', `Bearer ${sysToken}`);
    expect(sys.body.data.facilities).toHaveLength(2);
  });

  it('creates a doctor with a unique Doctor ID and login credentials; doctor can sign in with the Doctor ID', async () => {
    const res = await request(app).post('/api/v1/admin/doctors').set('Authorization', `Bearer ${adminToken}`).send(payload({ password: 'Clinic@2026x' }));
    expect(res.status).toBe(201);
    const { doctor, credentials } = res.body.data;
    expect(credentials.doctorId).toMatch(/^AD-DR-\d{5}$/);
    expect(credentials.loginId).toBe(credentials.doctorId.toLowerCase());
    expect(credentials.temporaryPassword).toBe('Clinic@2026x');
    expect(doctor).toMatchObject({ verificationStatus: 'pending_verification', departmentName: 'Oral Medicine & Radiology', consultationFee: 200, experienceYears: 8 });
    const stored: any = await User.findOne({ userId: doctor.userId }).lean();
    expect(stored.passwordHash).not.toContain('Clinic@2026x');

    const login = await request(app).post('/api/v1/auth/login').send({ username: credentials.doctorId, password: 'Clinic@2026x' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.userId).toBe(doctor.userId);

    const second = await request(app).post('/api/v1/admin/doctors').set('Authorization', `Bearer ${sysToken}`).send(payload({ hospitalId: 'hosp_admin_b', username: 'dr.second' }));
    expect(second.status).toBe(201);
    expect(second.body.data.credentials.loginId).toBe('dr.second');
    expect(second.body.data.credentials.temporaryPassword.length).toBeGreaterThanOrEqual(10);
    expect(second.body.data.credentials.doctorId).not.toBe(credentials.doctorId);
  });

  it('blocks other facilities, non-admins, duplicates and bad departments', async () => {
    const otherFacility = await request(app).post('/api/v1/admin/doctors').set('Authorization', `Bearer ${adminToken}`).send(payload({ hospitalId: 'hosp_admin_b' }));
    expect(otherFacility.status).toBe(403);
    const notAdmin = await request(app).post('/api/v1/admin/doctors').set('Authorization', `Bearer ${doctorToken}`).send(payload());
    expect(notAdmin.status).toBe(403);
    const badDept = await request(app).post('/api/v1/admin/doctors').set('Authorization', `Bearer ${adminToken}`).send(payload({ department: 'astrology' }));
    expect(badDept.status).toBe(400);
    const council = payload().councilRegistrationNumber;
    expect((await request(app).post('/api/v1/admin/doctors').set('Authorization', `Bearer ${adminToken}`).send(payload({ councilRegistrationNumber: council }))).status).toBe(201);
    expect((await request(app).post('/api/v1/admin/doctors').set('Authorization', `Bearer ${adminToken}`).send(payload({ councilRegistrationNumber: council }))).status).toBe(409);
  });

  it('lets a facility admin upload a qualification document (own facility only, signature checked)', async () => {
    const pdf = Buffer.from('%PDF-1.4\n%synthetic degree\n');
    const ok = await request(app).post('/api/v1/admin/doctors/documents').set('Authorization', `Bearer ${adminToken}`).field('hospitalId', 'hosp_admin_a').attach('file', pdf, { filename: 'degree.pdf', contentType: 'application/pdf' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.fileId).toBeTruthy();
    const other = await request(app).post('/api/v1/admin/doctors/documents').set('Authorization', `Bearer ${adminToken}`).field('hospitalId', 'hosp_admin_b').attach('file', pdf, { filename: 'degree.pdf', contentType: 'application/pdf' });
    expect(other.status).toBe(403);
    const created = await request(app).post('/api/v1/admin/doctors').set('Authorization', `Bearer ${adminToken}`).send(payload({ qualificationDocumentId: ok.body.data.fileId }));
    expect(created.status).toBe(201);
  });

  it('lists only in-scope doctors and verifies, rejects and resets passwords', async () => {
    const list = await request(app).get('/api/v1/admin/doctors?status=pending').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.doctors.every((d: any) => d.hospitalId === 'hosp_admin_a')).toBe(true);
    const [first, second] = list.body.data.doctors;

    const outside = (await request(app).get('/api/v1/admin/doctors').set('Authorization', `Bearer ${sysToken}`)).body.data.doctors.find((d: any) => d.hospitalId === 'hosp_admin_b');
    expect((await request(app).post(`/api/v1/admin/doctors/${outside.userId}/verify`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(403);

    const verified = await request(app).post(`/api/v1/admin/doctors/${first.userId}/verify`).set('Authorization', `Bearer ${adminToken}`);
    expect(verified.status).toBe(200);
    expect(((await User.findOne({ userId: first.userId }).lean()) as any).verificationStatus).toBe('verified');

    const rejected = await request(app).post(`/api/v1/admin/doctors/${second.userId}/reject`).set('Authorization', `Bearer ${adminToken}`).send({ reason: 'Council number does not match the document.' });
    expect(rejected.status).toBe(200);

    const reset = await request(app).post(`/api/v1/admin/doctors/${first.userId}/reset-password`).set('Authorization', `Bearer ${adminToken}`);
    expect(reset.status).toBe(200);
    const { loginId, temporaryPassword } = reset.body.data.credentials;
    expect((await request(app).post('/api/v1/auth/login').send({ username: loginId, password: temporaryPassword })).status).toBe(200);
  });
});
