import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Patient } from '../src/modules/patient/patientModel.js';
import { DuplicateReview } from '../src/modules/patient/duplicateReviewModel.js';
import { SyncLedger } from '../src/modules/patient/syncLedgerModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { AuditLog } from '../src/modules/audit/auditModel.js';
import { HealthWorkerAssignment } from '../src/modules/assignment/assignmentModel.js';
import { Village } from '../src/modules/reference/villageModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 4: Patients, Duplicate Review & Idempotent Sync Foundation', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  let adminToken: string;
  let adminUserId = 'usr_admin_paderu_patient';

  let ashaAssignedToken: string;
  let ashaAssignedId = 'usr_asha_assigned_patient';

  let ashaUnassignedToken: string;
  let ashaUnassignedId = 'usr_asha_unassigned_patient';

  let firstPatientId: string;
  let duplicatePatientId: string;
  let duplicateReviewId: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsPatients');
    await mongoose.connect(replSet.getUri());

    const pwd = await hashPassword('AdminPatient@2026');

    // 1. Create Admin
    await User.create({
      userId: adminUserId,
      username: 'admin.patient',
      role: 'admin',
      fullName: 'Patient Administration Officer',
      hospitalId: 'hosp_paderu_dh',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    adminToken = signAccessToken({
      userId: adminUserId,
      role: 'admin',
      scopes: getRoleCapabilities('admin'),
      deviceSessionId: 'ses_admin_patient',
      deviceId: 'dev_admin_patient',
    });

    // 2. Create Assigned ASHA
    await User.create({
      userId: ashaAssignedId,
      username: 'asha.assigned.patient',
      role: 'asha',
      fullName: 'Lakshmi Bai (Assigned ASHA)',
      hospitalId: 'hosp_paderu_dh',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    ashaAssignedToken = signAccessToken({
      userId: ashaAssignedId,
      role: 'asha',
      scopes: getRoleCapabilities('asha'),
      deviceSessionId: 'ses_asha_assigned',
      deviceId: 'dev_asha_assigned',
    });

    // Explicit assignment to vil_vankachinta_01
    await HealthWorkerAssignment.create({
      assignmentId: 'asgn_asha_pat_01',
      workerId: ashaAssignedId,
      workerName: 'Lakshmi Bai',
      workerRole: 'asha',
      hospitalId: 'hosp_paderu_dh',
      assignedMandal: 'Paderu',
      assignedVillages: ['vil_vankachinta_01'],
      assignedBy: adminUserId,
      status: 'active',
      assignedAt: new Date(),
      simulation: true,
    });

    // 3. Create Unassigned ASHA
    await User.create({
      userId: ashaUnassignedId,
      username: 'asha.unassigned.patient',
      role: 'asha',
      fullName: 'Radha Kumari (Unassigned ASHA)',
      hospitalId: 'hosp_paderu_dh',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    ashaUnassignedToken = signAccessToken({
      userId: ashaUnassignedId,
      role: 'asha',
      scopes: getRoleCapabilities('asha'),
      deviceSessionId: 'ses_asha_unassigned',
      deviceId: 'dev_asha_unassigned',
    });

    // 4. Seed Reference Village for Internal Mapping
    await Village.create({
      villageId: 'vil_vankachinta_01',
      villageName: 'Vankachinta',
      mandal: 'Paderu',
      panchayat: 'Vankachinta GP',
      tribalHabitation: 'Upper Vankachinta',
      hospitalId: 'hosp_paderu_dh',
      censusCode: '584011',
      populationEstimated: 650,
      simulation: true,
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('registers a patient OTP-free, generates tribal patient ID, and preserves original submitted address verbatim', async () => {
    const rawAddress = 'Near Old Borewell, Vankachinta Upper Habitation, Paderu Mandal, ASR District';

    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Korra Somulu',
        gender: 'male',
        ageEstimated: 54,
        phone: '9440188990',
        guardianName: 'Korra Somanna',
        villageId: 'vil_vankachinta_01',
        villageName: 'Vankachinta',
        mandal: 'Paderu',
        district: 'Alluri Sitharama Raju',
        originalAddressText: rawAddress,
        hospitalId: 'hosp_paderu_dh',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.patient.patientId).toMatch(/^PAD-\d{4}-[A-F0-9]{6}$/);
    expect(res.body.data.patient.fullName).toBe('Korra Somulu');
    expect(res.body.data.patient.originalAddressText).toBe(rawAddress);
    expect(res.body.data.patient.isDuplicateCandidate).toBe(false);
    expect(res.body.data.patient.duplicateReviewStatus).toBe('none');

    firstPatientId = res.body.data.patient.patientId;

    // Verify patient in MongoDB
    const saved = await Patient.findOne({ patientId: firstPatientId });
    expect(saved).not.toBeNull();
    expect(saved?.originalAddressText).toBe(rawAddress);
  });

  it('emits patient.registered event and records an audit log entry', async () => {
    // Wait briefly for asynchronous audit write
    await new Promise((r) => setTimeout(r, 200));

    const auditEntry = await AuditLog.findOne({
      action: 'PATIENT_REGISTERED',
      resourceId: firstPatientId,
    });

    expect(auditEntry).not.toBeNull();
    expect(auditEntry?.resourceType).toBe('patient');
    expect(auditEntry?.metadata?.hasOriginalAddressText).toBe(true);
  });

  it('DUPLICATES FLAGGED: Intaking candidate with phonetic similarity, same village & age flags candidate with review ticket', async () => {
    // Phonetic variation: Korra Somanna / Korra Somulu, same village, same age, same phone
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Korra Somanna', // Phonetically & clan-prefix similar
        gender: 'male',
        ageEstimated: 55, // Within 2 years of 54
        phone: '9440188990', // Exact phone match
        villageId: 'vil_vankachinta_01',
        villageName: 'Vankachinta',
        mandal: 'Paderu',
        originalAddressText: 'Opposite Primary School, Vankachinta, Paderu',
        hospitalId: 'hosp_paderu_dh',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.patient.isDuplicateCandidate).toBe(true);
    expect(res.body.data.patient.duplicateReviewStatus).toBe('pending_review');
    expect(res.body.data.duplicateReview.flagged).toBe(true);
    expect(res.body.data.duplicateReview.matchScore).toBeGreaterThanOrEqual(75);
    expect(res.body.data.duplicateReview.candidatePatientId).toBe(firstPatientId);
    expect(res.body.data.duplicateReview.policy).toContain('never auto-merged');

    duplicatePatientId = res.body.data.patient.patientId;
    duplicateReviewId = res.body.data.duplicateReview.reviewId;
  });

  it('DUPLICATES NEVER MERGED: Both the original and candidate records exist as separate independent documents', async () => {
    const allPatients = await Patient.find({
      patientId: { $in: [firstPatientId, duplicatePatientId] },
    });

    // Both distinct documents MUST exist in the collection! Never auto-merged!
    expect(allPatients.length).toBe(2);

    const original = allPatients.find((p) => p.patientId === firstPatientId);
    const candidate = allPatients.find((p) => p.patientId === duplicatePatientId);

    expect(original).toBeDefined();
    expect(candidate).toBeDefined();
    expect(original?.patientId).not.toBe(candidate?.patientId);
    expect(candidate?.isDuplicateCandidate).toBe(true);
    expect(candidate?.duplicateCandidateOf).toBe(original?.patientId);
  });

  it('REPLAYED REQUEST CREATES NO SECOND RECORD: Repeated submission with same clientMutationId returns existing record', async () => {
    const mutationId = 'mut_test_replay_dedup_001';
    const initialCount = await Patient.countDocuments();

    // 1. First submission with clientMutationId
    const res1 = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Gemmeli Subba Rao',
        gender: 'male',
        ageEstimated: 42,
        phone: '9848011223',
        villageId: 'vil_minumuluru_02',
        villageName: 'Minumuluru',
        mandal: 'Paderu',
        originalAddressText: 'Near GP Office, Minumuluru, Paderu Mandal',
        hospitalId: 'hosp_paderu_dh',
        clientMutationId: mutationId,
      });

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    const createdPatientId = res1.body.data.patient.patientId;

    const afterFirstCount = await Patient.countDocuments();
    expect(afterFirstCount).toBe(initialCount + 1);

    // Verify written to SyncLedger
    const ledger = await SyncLedger.findOne({ clientMutationId: mutationId });
    expect(ledger).not.toBeNull();
    expect(ledger?.entityId).toBe(createdPatientId);

    // 2. Replay request with IDENTICAL clientMutationId (network retry or sync storm)
    const res2 = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Gemmeli Subba Rao',
        gender: 'male',
        ageEstimated: 42,
        phone: '9848011223',
        villageId: 'vil_minumuluru_02',
        villageName: 'Minumuluru',
        mandal: 'Paderu',
        originalAddressText: 'Near GP Office, Minumuluru, Paderu Mandal',
        hospitalId: 'hosp_paderu_dh',
        clientMutationId: mutationId, // SAME ID
      });

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(res2.body.data.idempotentReplay).toBe(true);
    expect(res2.body.data.patient.patientId).toBe(createdPatientId);
    expect(res2.body.data.message).toContain('creates no second record');

    // 3. STRICT ASSERTION: Total document count MUST NOT have increased!
    const afterReplayCount = await Patient.countDocuments();
    expect(afterReplayCount).toBe(afterFirstCount);
  });

  it('allows administrator to inspect duplicate review tickets and resolve as confirmed distinct', async () => {
    // 1. Query pending reviews
    const listRes = await request(app)
      .get('/api/v1/patients/duplicates/review')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.reviews.length).toBeGreaterThanOrEqual(1);

    const ticket = listRes.body.data.reviews.find((r: any) => r.reviewId === duplicateReviewId);
    expect(ticket).toBeDefined();
    expect(ticket.matchScore).toBeGreaterThanOrEqual(75);

    // 2. Resolve review as confirmed distinct
    const resolveRes = await request(app)
      .post(`/api/v1/patients/duplicates/${duplicateReviewId}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        resolution: 'resolved_distinct',
        resolutionNotes: 'Verified ration cards: Patients are paternal cousins living in separate households.',
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.success).toBe(true);
    expect(resolveRes.body.data.status).toBe('resolved_distinct');

    // Patient record updated
    const updatedPatient = await Patient.findOne({ patientId: duplicatePatientId });
    expect(updatedPatient?.duplicateReviewStatus).toBe('confirmed_distinct');
    expect(updatedPatient?.isDuplicateCandidate).toBe(false);
  });

  it('Health Worker sees ONLY patients in explicitly assigned villages; unassigned sees zero', async () => {
    // 1. Assigned ASHA queries patients (assigned to vil_vankachinta_01)
    const assignedRes = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${ashaAssignedToken}`);

    expect(assignedRes.status).toBe(200);
    expect(assignedRes.body.success).toBe(true);
    expect(assignedRes.body.data.patients.length).toBeGreaterThanOrEqual(1);
    // Every patient returned MUST belong to the assigned village
    for (const pat of assignedRes.body.data.patients) {
      expect(pat.villageId).toBe('vil_vankachinta_01');
    }

    // 2. Unassigned ASHA queries patients
    const unassignedRes = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${ashaUnassignedToken}`);

    expect(unassignedRes.status).toBe(200);
    expect(unassignedRes.body.success).toBe(true);
    expect(unassignedRes.body.data.patients.length).toBe(0);
    expect(unassignedRes.body.data.total).toBe(0);
    expect(unassignedRes.body.data.assignedScopeOnly).toBe(true);
  });

  it('NO VILLAGE ID REQUIRED: registers a patient without entering Village ID, resolving village mapping internally from villageName & mandal', async () => {
    // Notice: villageId is completely omitted from the request payload
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Korra Sanyasi Rao',
        gender: 'male',
        ageEstimated: 38,
        phone: '9440155667',
        guardianName: 'Korra Chinnodu',
        villageName: 'Vankachinta', // Name provided in human-readable form
        mandal: 'Paderu',
        district: 'Alluri Sitharama Raju',
        originalAddressText: 'Near Mango Grove, Vankachinta, Paderu Mandal',
        hospitalId: 'hosp_paderu_dh',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.patient.patientId).toMatch(/^PAD-\d{4}-[A-F0-9]{6}$/);
    expect(res.body.data.patient.fullName).toBe('Korra Sanyasi Rao');
    // Village ID was resolved internally to vil_vankachinta_01 without manual entry
    expect(res.body.data.patient.villageId).toBe('vil_vankachinta_01');
    expect(res.body.data.patient.villageName).toBe('Vankachinta');
  });

  it('NO VILLAGE ID REQUIRED: ASHA worker registers patient for uncataloged hamlet, resolving to active assignment jurisdiction', async () => {
    // ASHA worker Lakshmi Bai is assigned to vil_vankachinta_01
    // Patient enters a local tribal hamlet not in reference table
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${ashaAssignedToken}`)
      .send({
        fullName: 'Vanum Kondamma',
        gender: 'female',
        ageEstimated: 46,
        villageName: 'Chinna Kothuru Hamlet',
        mandal: 'Paderu',
        originalAddressText: 'Next to Hillside Stream, Chinna Kothuru, Paderu',
        hospitalId: 'hosp_paderu_dh',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.patient.fullName).toBe('Vanum Kondamma');
    // Resolved to ASHA worker's assigned village jurisdiction
    expect(res.body.data.patient.villageId).toBe('vil_vankachinta_01');
  });

  it('NO VILLAGE ID REQUIRED: generates clean standardized slug when hamlet is remote and uncataloged', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Killo Bojjanna',
        gender: 'male',
        ageEstimated: 60,
        villageName: 'Pedda Valasa Remote Settlement',
        mandal: 'Chintapalli',
        originalAddressText: 'Top of Eastern Ghats Ridge, Pedda Valasa, Chintapalli',
        hospitalId: 'hosp_chintapalli_chc',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.patient.villageId).toMatch(/^vil_chintapalli_/);
  });

  it('NO VILLAGE ID REQUIRED: offline batch sync processes patient records without villageId', async () => {
    const syncRes = await request(app)
      .post('/api/v1/patients/sync')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            clientMutationId: 'mut_sync_no_vid_001',
            patientData: {
              fullName: 'Pangi Neelamma',
              gender: 'female',
              ageEstimated: 33,
              villageName: 'Vankachinta',
              mandal: 'Paderu',
              originalAddressText: 'Near Tribal Welfare Ashram School, Vankachinta',
              hospitalId: 'hosp_paderu_dh',
            },
          },
        ],
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.success).toBe(true);
    expect(syncRes.body.data.processedCount).toBe(1);
    expect(syncRes.body.data.results[0].status).toBe('created');

    const syncedPatient = await Patient.findOne({ fullName: 'Pangi Neelamma' });
    expect(syncedPatient).not.toBeNull();
    expect(syncedPatient?.villageId).toBe('vil_vankachinta_01');
  });
});
