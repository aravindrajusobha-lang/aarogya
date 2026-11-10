import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Specialist } from '../src/modules/specialist/specialistModel.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 3 Administration: Specialists Directory & Teleconsult Availability', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  let moToken: string;
  let patientToken: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsSpecialists');
    await mongoose.connect(replSet.getUri());

    moToken = signAccessToken({
      userId: 'usr_mo_spec_test',
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_spec_mo',
      deviceId: 'dev_spec_mo',
    });

    patientToken = signAccessToken({
      userId: 'usr_pat_spec_test',
      role: 'patient',
      scopes: getRoleCapabilities('patient'),
      deviceSessionId: 'ses_spec_pat',
      deviceId: 'dev_spec_pat',
    });

    // Seed 2 Specialists
    await Specialist.create([
      {
        specialistId: 'spec_onco_001',
        name: 'Dr. Ananya Rao, MCh',
        specialty: 'oral_oncology',
        hospitalId: 'hosp_paderu_dh',
        hospitalName: 'Paderu District Hospital',
        qualifications: ['MBBS', 'MS (Gen Surg)', 'MCh (Surgical Oncology)'],
        teleconsultAvailable: true,
        contactPhone: '+918912887766',
        email: 'ananya.oncology@health.ap.gov.in',
        languages: ['te', 'en'],
        status: 'active',
        simulation: true,
      },
      {
        specialistId: 'spec_maxillo_002',
        name: 'Dr. Vikram Chandra, MDS',
        specialty: 'maxillofacial_surgery',
        hospitalId: 'hosp_visakha_kgh',
        hospitalName: 'King George Hospital / AMC Visakhapatnam',
        qualifications: ['BDS', 'MDS (Oral & Maxillofacial Surgery)'],
        teleconsultAvailable: false,
        contactPhone: '+918912887767',
        email: 'vikram.omfs@kgh.ap.gov.in',
        languages: ['te', 'en', 'hi'],
        status: 'active',
        simulation: true,
      },
    ]);
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('allows staff to query full active specialists directory', async () => {
    const res = await request(app)
      .get('/api/v1/specialists')
      .set('Authorization', `Bearer ${moToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specialists.length).toBe(2);
  });

  it('filters specialists by specialty (oral_oncology)', async () => {
    const res = await request(app)
      .get('/api/v1/specialists?specialty=oral_oncology')
      .set('Authorization', `Bearer ${moToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.specialists.length).toBe(1);
    expect(res.body.data.specialists[0].name).toContain('Dr. Ananya Rao');
  });

  it('filters specialists by teleconsultAvailable=true', async () => {
    const res = await request(app)
      .get('/api/v1/specialists?teleconsultAvailable=true')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.specialists.length).toBe(1);
    expect(res.body.data.specialists[0].teleconsultAvailable).toBe(true);
  });

  it('allows Medical Officer to register a new specialist', async () => {
    const res = await request(app)
      .post('/api/v1/specialists')
      .set('Authorization', `Bearer ${moToken}`)
      .send({
        name: 'Dr. K. Srinivas, MS',
        specialty: 'ent_head_neck',
        hospitalId: 'hosp_paderu_dh',
        hospitalName: 'Paderu District Hospital',
        qualifications: ['MBBS', 'MS (ENT Head & Neck)'],
        teleconsultAvailable: true,
        contactPhone: '+918912887768',
        email: 'srinivas.ent@paderu.gov.in',
        languages: ['te', 'en'],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.specialist.specialty).toBe('ent_head_neck');
  });
});
