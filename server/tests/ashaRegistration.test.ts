import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { HealthWorkerAssignment } from '../src/modules/assignment/assignmentModel.js';
import { Patient } from '../src/modules/patient/patientModel.js';
import { Village } from '../src/modules/reference/villageModel.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('ASHA worker self-registration and review', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();
  let adminToken: string;
  let otherAdminToken: string;
  let systemAdminToken: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsAshaRegistration');
    await mongoose.connect(replSet.getUri());
    await Hospital.create([
      { hospitalId: 'asha_facility_a', name: 'Facility A', type: 'primary_health_centre', district: 'ASR', mandal: 'Paderu', status: 'active' },
      { hospitalId: 'asha_facility_b', name: 'Facility B', type: 'primary_health_centre', district: 'ASR', mandal: 'Araku', status: 'active' },
    ]);
    await User.create([
      { userId: 'asha_admin_a', username: 'asha_admin_a', fullName: 'Facility Admin A', role: 'admin', hospitalId: 'asha_facility_a', passwordHash: 'x', status: 'active' },
      { userId: 'asha_admin_b', username: 'asha_admin_b', fullName: 'Facility Admin B', role: 'admin', hospitalId: 'asha_facility_b', passwordHash: 'x', status: 'active' },
      { userId: 'asha_sys_admin', username: 'asha_sys_admin', fullName: 'System Admin', role: 'system_admin', passwordHash: 'x', status: 'active' },
    ]);
    adminToken = signAccessToken({ userId: 'asha_admin_a', role: 'admin', hospitalId: 'asha_facility_a', scopes: getRoleCapabilities('admin') });
    otherAdminToken = signAccessToken({ userId: 'asha_admin_b', role: 'admin', hospitalId: 'asha_facility_b', scopes: getRoleCapabilities('admin') });
    systemAdminToken = signAccessToken({ userId: 'asha_sys_admin', role: 'system_admin', scopes: getRoleCapabilities('system_admin') });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('creates a pending account, blocks its login, and restricts review to the facility', async () => {
    const facilities = await request(app).get('/api/v1/asha-registration/facilities');
    expect(facilities.status).toBe(200);
    expect(facilities.body.data.facilities.map((facility: any) => facility.hospitalId)).toEqual(['asha_facility_a', 'asha_facility_b']);

    const submitted = await request(app).post('/api/v1/asha-registration/register').send({
      username: 'asha.new.worker',
      password: 'AshaSecure@2026',
      fullName: 'New ASHA Worker',
      phone: '+919876543212',
      hospitalId: 'asha_facility_a',
      mandal: 'Paderu',
      village: 'Sample Village',
    });
    expect(submitted.status).toBe(201);
    expect(submitted.body.data.applicationReference).toMatch(/^ASHA-[A-F0-9]{10}$/);

    const pending = await User.findOne({ username: 'asha.new.worker' }).lean() as any;
    expect(pending).toMatchObject({ role: 'asha_worker', status: 'suspended', approvalStatus: 'PENDING_ADMIN_APPROVAL' });
    expect(pending.passwordHash).not.toContain('AshaSecure@2026');

    const login = await request(app).post('/api/v1/auth/login').send({ username: 'asha.new.worker', password: 'AshaSecure@2026' });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_NOT_ACTIVE');

    const duplicate = await request(app).post('/api/v1/asha-registration/register').send({
      username: 'asha.new.worker',
      password: 'AshaSecure@2026',
      fullName: 'New ASHA Worker',
      phone: '+919876543212',
      hospitalId: 'asha_facility_a',
      mandal: 'Paderu',
      village: 'Sample Village',
    });
    expect(duplicate.status).toBe(409);

    const invalidFacility = await request(app).post('/api/v1/asha-registration/register').send({
      username: 'asha.bad.facility',
      password: 'AshaSecure@2026',
      fullName: 'New ASHA Worker',
      phone: '+919876543212',
      hospitalId: 'asha_facility_a',
      mandal: 'Araku',
      village: 'Sample Village',
    });
    expect(invalidFacility.status).toBe(400);

    const apps = await request(app).get('/api/v1/asha-registration/applications').set('Authorization', `Bearer ${adminToken}`);
    expect(apps.status).toBe(200);
    expect(apps.body.data.applications.map((application: any) => application.userId)).toContain(pending.userId);

    const wrongFacility = await request(app).post(`/api/v1/asha-registration/${pending.userId}/approve`).set('Authorization', `Bearer ${otherAdminToken}`);
    expect(wrongFacility.status).toBe(404);
  });

  it('approves an application and allows login only after approval', async () => {
    const submitted = await request(app).post('/api/v1/asha-registration/register').send({
      username: 'asha.approved.worker',
      password: 'AshaSecure@2026',
      fullName: 'Approved ASHA Worker',
      phone: '+919876543213',
      hospitalId: 'asha_facility_a',
      mandal: 'Paderu',
      village: 'Another Village',
    });
    expect(submitted.status).toBe(201);
    const applicant = await User.findOne({ username: 'asha.approved.worker' }).lean() as any;

    const approved = await request(app).post(`/api/v1/asha-registration/${applicant.userId}/approve`).set('Authorization', `Bearer ${adminToken}`);
    expect(approved.status).toBe(200);
    expect(approved.body.meta.message).toContain('Assign the worker to their villages');

    const activated = await User.findOne({ userId: applicant.userId }).lean() as any;
    expect(activated).toMatchObject({ status: 'active', approvalStatus: 'ACTIVE', verificationStatus: 'verified' });
    const login = await request(app).post('/api/v1/auth/login').send({ username: 'asha.approved.worker', password: 'AshaSecure@2026' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('asha_worker');

    const allApps = await request(app).get('/api/v1/asha-registration/applications').set('Authorization', `Bearer ${systemAdminToken}`);
    expect(allApps.status).toBe(200);
    expect(allApps.body.data.applications.some((application: any) => application.userId === applicant.userId)).toBe(false);
  });

  it('rejects pending applications with a required reason', async () => {
    const submitted = await request(app).post('/api/v1/asha-registration/register').send({
      username: 'asha.rejected.worker',
      password: 'AshaSecure@2026',
      fullName: 'Rejected ASHA Worker',
      phone: '+919876543214',
      hospitalId: 'asha_facility_a',
      mandal: 'Paderu',
      village: 'Third Village',
    });
    expect(submitted.status).toBe(201);
    const applicant = await User.findOne({ username: 'asha.rejected.worker' }).lean() as any;

    const rejected = await request(app).post(`/api/v1/asha-registration/${applicant.userId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`).send({ reason: 'Facility records need verification.' });
    expect(rejected.status).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({ username: 'asha.rejected.worker', password: 'AshaSecure@2026' });
    expect(login.status).toBe(403);
  });

  it('limits patient registration and tracking to the worker’s assigned villages', async () => {
    const workerId = 'asha_scoped_worker';
    await User.create({
      userId: workerId,
      username: workerId,
      fullName: 'Scoped ASHA Worker',
      role: 'asha_worker',
      hospitalId: 'asha_facility_a',
      passwordHash: 'x',
      status: 'active',
    });
    const workerToken = signAccessToken({
      userId: workerId,
      role: 'asha_worker',
      hospitalId: 'asha_facility_a',
      scopes: getRoleCapabilities('asha_worker'),
    });

    await Village.create([
      {
        villageId: 'asha_assigned_village',
        villageName: 'Assigned Hamlet',
        mandal: 'Paderu',
        panchayat: 'Assigned Panchayat',
        tribalHabitation: 'Assigned Hamlet',
        hospitalId: 'asha_facility_a',
        censusCode: 'ASHA-ASSIGNED',
      },
      {
        villageId: 'asha_unassigned_village',
        villageName: 'Unassigned Hamlet',
        mandal: 'Paderu',
        panchayat: 'Other Panchayat',
        tribalHabitation: 'Unassigned Hamlet',
        hospitalId: 'asha_facility_a',
        censusCode: 'ASHA-UNASSIGNED',
      },
    ]);
    await HealthWorkerAssignment.create({
      assignmentId: 'asha_scoped_assignment',
      workerId,
      workerName: 'Scoped ASHA Worker',
      workerRole: 'asha_worker',
      hospitalId: 'asha_facility_a',
      assignedMandal: 'Paderu',
      assignedVillages: ['asha_assigned_village'],
      assignedBy: 'asha_admin_a',
    });

    const registered = await request(app).post('/api/v1/patients')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        fullName: 'Assigned Patient',
        gender: 'female',
        ageEstimated: 42,
        villageId: 'asha_assigned_village',
        villageName: 'Assigned Hamlet',
        mandal: 'Paderu',
        district: 'ASR',
        originalAddressText: 'Assigned Hamlet, Paderu',
        hospitalId: 'asha_facility_a',
        registrationMethod: 'health_worker_assisted',
        emergencyContact: 'Name: Field Contact; Phone: +919876500001',
        caregiverDetails: 'Name: Family Caregiver; Phone: +919876500002',
        maskedAadhaar: 'XXXX-XXXX-1234',
      });
    expect(registered.status).toBe(201);
    const patientId = registered.body.data.patient.patientId as string;
    expect(registered.body.data.patient.villageId).toBe('asha_assigned_village');
    expect(registered.body.data.patient.emergencyContact).toBe('Name: Field Contact; Phone: +919876500001');
    expect(registered.body.data.patient.caregiverDetails).toBe('Name: Family Caregiver; Phone: +919876500002');
    expect(registered.body.data.patient.maskedAadhaar).toBeUndefined();

    const outOfScopeRegistration = await request(app).post('/api/v1/patients')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({
        fullName: 'Out of Scope Patient',
        gender: 'male',
        ageEstimated: 36,
        villageId: 'asha_unassigned_village',
        villageName: 'Unassigned Hamlet',
        mandal: 'Paderu',
        district: 'ASR',
        originalAddressText: 'Unassigned Hamlet, Paderu',
        hospitalId: 'asha_facility_a',
      });
    expect(outOfScopeRegistration.status).toBe(403);

    const outOfScopePatientId = 'ASR-OUT-OF-SCOPE';
    await Patient.create({
      patientId: outOfScopePatientId,
      fullName: 'Existing Out of Scope Patient',
      gender: 'male',
      ageEstimated: 30,
      villageId: 'asha_unassigned_village',
      villageName: 'Unassigned Hamlet',
      mandal: 'Paderu',
      district: 'ASR',
      originalAddressText: 'Unassigned Hamlet, Paderu',
      hospitalId: 'asha_facility_a',
      registeredBy: 'other_worker',
      registeredAt: new Date(),
      matchReasons: [],
    });
    const otherFacilityPatientId = 'ASR-OTHER-FACILITY';
    await Patient.create({
      patientId: otherFacilityPatientId,
      fullName: 'Existing Other Facility Patient',
      gender: 'female',
      ageEstimated: 28,
      villageId: 'asha_assigned_village',
      villageName: 'Assigned Hamlet',
      mandal: 'Paderu',
      district: 'ASR',
      originalAddressText: 'Assigned Hamlet, Paderu',
      hospitalId: 'asha_facility_b',
      registeredBy: 'other_worker',
      registeredAt: new Date(),
      matchReasons: [],
    });

    const listing = await request(app).get('/api/v1/patients').set('Authorization', `Bearer ${workerToken}`);
    expect(listing.status).toBe(200);
    expect(listing.body.data.patients.map((patient: any) => patient.patientId)).toEqual([patientId]);
    expect(listing.body.data.patients[0].flow).toEqual({
      screening: 'not_started',
      aiScreening: { status: 'not_started' },
      referral: 'not_referred',
      appointment: 'not_booked',
    });

    const ownPatient = await request(app).get(`/api/v1/patients/${patientId}`).set('Authorization', `Bearer ${workerToken}`);
    expect(ownPatient.status).toBe(200);
    const otherPatient = await request(app).get(`/api/v1/patients/${outOfScopePatientId}`).set('Authorization', `Bearer ${workerToken}`);
    expect(otherPatient.status).toBe(404);
    const otherFacilityPatient = await request(app).get(`/api/v1/patients/${otherFacilityPatientId}`).set('Authorization', `Bearer ${workerToken}`);
    expect(otherFacilityPatient.status).toBe(404);
  });
});
