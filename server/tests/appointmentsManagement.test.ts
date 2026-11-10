import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Appointment } from '../src/modules/appointment/appointmentModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { AuditLog } from '../src/modules/audit/auditModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 10: Patient Appointments Scheduling & ACID Slot Governance', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  // Hospital A: Paderu District Hospital
  const hospPaderuId = 'hosp_paderu_apt_01';
  let adminPaderuToken: string;
  const adminPaderuId = 'usr_admin_paderu_p10';
  let moPaderuToken: string;
  const moPaderuId = 'usr_mo_paderu_p10';

  // Hospital B: Chintapalli CHC (Different hospital)
  const hospChintapalliId = 'hosp_chintapalli_apt_02';
  let adminChintapalliToken: string;
  const adminChintapalliId = 'usr_admin_chintapalli_p10';
  let moChintapalliToken: string;
  const moChintapalliId = 'usr_mo_chintapalli_p10';

  // Frontline Health Worker (ASHA) & Patient
  let ashaToken: string;
  const ashaId = 'usr_asha_apt_01';
  let patientToken: string;
  const patientId = 'usr_pat_apt_01';

  // Compute a future test Monday date at 10:00 AM
  const getFutureTestDate = (daysAhead = 14, hour = 10, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    // Ensure Monday - Saturday (if Sunday, add 1 day)
    if (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsAppointments');
    await mongoose.connect(replSet.getUri());
    await Appointment.syncIndexes();

    const pwd = await hashPassword('AptPass@2026');

    // 1. Create Hospitals
    await Hospital.create({
      hospitalId: hospPaderuId,
      name: 'Paderu District Hospital',
      mandal: 'Paderu',
      district: 'Alluri Sitharama Raju',
      type: 'district_hospital',
      bedCapacity: 100,
      status: 'active',
      simulation: true,
    });

    await Hospital.create({
      hospitalId: hospChintapalliId,
      name: 'Chintapalli Community Health Centre',
      mandal: 'Chintapalli',
      district: 'Alluri Sitharama Raju',
      type: 'community_health_centre',
      bedCapacity: 30,
      status: 'active',
      simulation: true,
    });

    // 2. Create Users
    await User.create({
      userId: adminPaderuId,
      username: 'admin_paderu_p10',
      fullName: 'Dr. Paderu Superintendent',
      role: 'admin',
      hospitalId: hospPaderuId,
      passwordHash: pwd,
      mfaEnabled: false,
    });

    await User.create({
      userId: moPaderuId,
      username: 'mo_paderu_p10',
      fullName: 'Dr. Ananya MO Paderu',
      role: 'medical_officer',
      hospitalId: hospPaderuId,
      passwordHash: pwd,
      mfaEnabled: false,
    });

    await User.create({
      userId: adminChintapalliId,
      username: 'admin_chintapalli_p10',
      fullName: 'Dr. Chintapalli Manager',
      role: 'admin',
      hospitalId: hospChintapalliId,
      passwordHash: pwd,
      mfaEnabled: false,
    });

    await User.create({
      userId: moChintapalliId,
      username: 'mo_chintapalli_p10',
      fullName: 'Dr. Mohan MO Chintapalli',
      role: 'medical_officer',
      hospitalId: hospChintapalliId,
      passwordHash: pwd,
      mfaEnabled: false,
    });

    await User.create({
      userId: ashaId,
      username: 'asha_p10',
      fullName: 'Lakshmi ASHA Worker',
      role: 'asha',
      hospitalId: hospPaderuId,
      passwordHash: pwd,
      mfaEnabled: false,
    });

    await User.create({
      userId: patientId,
      username: 'patient_p10',
      fullName: 'Appala Kondamma',
      role: 'patient',
      passwordHash: pwd,
      mfaEnabled: false,
    });

    // 3. Generate Auth Tokens
    adminPaderuToken = signAccessToken({
      userId: adminPaderuId,
      role: 'admin',
      hospitalId: hospPaderuId,
      capabilities: getRoleCapabilities('admin'),
    });

    moPaderuToken = signAccessToken({
      userId: moPaderuId,
      role: 'medical_officer',
      hospitalId: hospPaderuId,
      capabilities: getRoleCapabilities('medical_officer'),
    });

    adminChintapalliToken = signAccessToken({
      userId: adminChintapalliId,
      role: 'admin',
      hospitalId: hospChintapalliId,
      capabilities: getRoleCapabilities('admin'),
    });

    moChintapalliToken = signAccessToken({
      userId: moChintapalliId,
      role: 'medical_officer',
      hospitalId: hospChintapalliId,
      capabilities: getRoleCapabilities('medical_officer'),
    });

    ashaToken = signAccessToken({
      userId: ashaId,
      role: 'asha',
      hospitalId: hospPaderuId,
      capabilities: getRoleCapabilities('asha'),
    });

    patientToken = signAccessToken({
      userId: patientId,
      role: 'patient',
      capabilities: getRoleCapabilities('patient'),
    });
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  // --------------------------------------------------------------------------
  // 1. Slot Availability & Working Hours
  // --------------------------------------------------------------------------
  describe('1. Slot Generation & Working Hours Schedule (09:00 - 16:00)', () => {
    it('generates standard 20-minute consultation slots excluding 13:00-14:00 lunch recess', async () => {
      const validDate = getFutureTestDate(7, 10, 0);

      const res = await request(app)
        .get(`/api/v1/appointments/slots?date=${validDate.toISOString()}&hospitalId=${hospPaderuId}`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slotDurationMinutes).toBe(20);
      expect(res.body.data.totalSlots).toBe(18); // 12 morning slots + 6 afternoon slots
      expect(res.body.data.slots.length).toBe(18);

      // Verify no slot exists between 13:00 and 14:00
      const lunchSlots = res.body.data.slots.filter((s: any) => {
        const h = new Date(s.startTime).getHours();
        return h === 13;
      });
      expect(lunchSlots.length).toBe(0);
    });

    it('returns empty slots array on Sunday (OPD closed)', async () => {
      const sundayDate = new Date();
      sundayDate.setDate(sundayDate.getDate() + ((7 - sundayDate.getDay()) % 7 || 7)); // Next Sunday
      sundayDate.setHours(10, 0, 0, 0);

      const res = await request(app)
        .get(`/api/v1/appointments/slots?date=${sundayDate.toISOString()}&hospitalId=${hospPaderuId}`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.slots).toEqual([]);
      expect(res.body.data.totalSlots).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Booking Validations & Clinical Slot Constraints
  // --------------------------------------------------------------------------
  describe('2. Booking Validations & Working Hours Rules', () => {
    it('rejects appointment request scheduled in the past', async () => {
      const pastStart = new Date(Date.now() - 3600000); // 1 hour ago
      const pastEnd = new Date(pastStart.getTime() + 20 * 60000);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: pastStart.toISOString(),
          slotEndTime: pastEnd.toISOString(),
          type: 'screening_review',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_APPOINTMENT_SLOT');
    });

    it('rejects appointment scheduled on Sunday', async () => {
      const sunday = new Date();
      sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7 || 7));
      sunday.setHours(10, 0, 0, 0);
      const sundayEnd = new Date(sunday.getTime() + 20 * 60000);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: sunday.toISOString(),
          slotEndTime: sundayEnd.toISOString(),
          type: 'screening_review',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CLINIC_CLOSED_SUNDAY');
    });

    it('rejects appointment scheduled outside working hours (e.g. 17:30)', async () => {
      const eveningStart = getFutureTestDate(10, 17, 30);
      const eveningEnd = new Date(eveningStart.getTime() + 20 * 60000);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: eveningStart.toISOString(),
          slotEndTime: eveningEnd.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OUTSIDE_WORKING_HOURS');
    });

    it('rejects appointment scheduled during lunch recess (13:20)', async () => {
      const lunchStart = getFutureTestDate(11, 13, 20);
      const lunchEnd = new Date(lunchStart.getTime() + 20 * 60000);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: lunchStart.toISOString(),
          slotEndTime: lunchEnd.toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('LUNCH_RECESS_CONFLICT');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Idempotent Booking & Offline Sync Replay
  // --------------------------------------------------------------------------
  describe('3. Idempotent Creation & Offline Sync Replay', () => {
    const offlineIdempotencyKey = 'offline_batch_sync_key_9999';
    let bookedAppointmentId: string;

    it('first request with idempotencyKey creates new appointment record', async () => {
      const slotStart = getFutureTestDate(12, 10, 0);
      const slotEnd = new Date(slotStart.getTime() + 20 * 60000);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: slotStart.toISOString(),
          slotEndTime: slotEnd.toISOString(),
          type: 'clinical_consultation',
          reason: 'Frontline visual oral screening referral',
          idempotencyKey: offlineIdempotencyKey,
          offlineQueued: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.idempotentReplay).toBe(false);
      expect(res.body.data.appointment.status).toBe('requested');
      expect(res.body.data.appointment.offlineQueued).toBe(true);

      // Verify Notification via Phase 5 core shows SMS and email as BLOCKED
      expect(res.body.data.notification).toBeDefined();
      expect(res.body.data.notification.smsBlocked).toBe(true);
      expect(res.body.data.notification.emailBlocked).toBe(true);

      bookedAppointmentId = res.body.data.appointment.appointmentId;
    });

    it('replayed offline-queued request with same idempotencyKey returns existing record without second creation', async () => {
      const slotStart = getFutureTestDate(12, 10, 0);
      const slotEnd = new Date(slotStart.getTime() + 20 * 60000);

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: slotStart.toISOString(),
          slotEndTime: slotEnd.toISOString(),
          type: 'clinical_consultation',
          idempotencyKey: offlineIdempotencyKey,
          offlineQueued: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.idempotentReplay).toBe(true);
      expect(res.body.data.appointment.appointmentId).toBe(bookedAppointmentId);

      // Verify in database that exactly ONE appointment document exists for this key
      const count = await Appointment.countDocuments({ idempotencyKey: offlineIdempotencyKey });
      expect(count).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 4. ACID Concurrency: Simultaneous Slot Requests
  // --------------------------------------------------------------------------
  describe('4. ACID Concurrency: Two Simultaneous Requests for One Slot', () => {
    it('two simultaneous requests for the same slot produce exactly one booking and one 409 conflict', async () => {
      const conflictSlotStart = getFutureTestDate(15, 11, 20);
      const conflictSlotEnd = new Date(conflictSlotStart.getTime() + 20 * 60000);

      const reqPayload1 = {
        patientId: 'usr_pat_contestant_01',
        destinationHospitalId: hospPaderuId,
        slotStartTime: conflictSlotStart.toISOString(),
        slotEndTime: conflictSlotEnd.toISOString(),
        idempotencyKey: 'race_req_slot_user_1',
      };

      const reqPayload2 = {
        patientId: 'usr_pat_contestant_02',
        destinationHospitalId: hospPaderuId,
        slotStartTime: conflictSlotStart.toISOString(),
        slotEndTime: conflictSlotEnd.toISOString(),
        idempotencyKey: 'race_req_slot_user_2',
      };

      // Execute concurrently
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/appointments')
          .set('Authorization', `Bearer ${ashaToken}`)
          .send(reqPayload1),
        request(app)
          .post('/api/v1/appointments')
          .set('Authorization', `Bearer ${ashaToken}`)
          .send(reqPayload2),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // One must succeed (201) and one must be rejected with 409 conflict
      expect(statuses).toEqual([201, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.error.code).toBe('SLOT_CONFLICT');

      // Verify in MongoDB that exactly ONE appointment exists for that slot
      const totalBooked = await Appointment.countDocuments({
        destinationHospitalId: hospPaderuId,
        slotStartTime: conflictSlotStart,
        slotEndTime: conflictSlotEnd,
        status: { $in: ['requested', 'confirmed', 'checked_in'] },
      });
      expect(totalBooked).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Confirmation Authorization Rules
  // --------------------------------------------------------------------------
  describe('5. Appointment Confirmation Authorization & Self-Confirmation Guards', () => {
    let paderuAppointmentId: string;
    let moCreatedAppointmentId: string;

    beforeAll(async () => {
      // 1. Appointment requested by ASHA for Paderu DH
      const slot1 = getFutureTestDate(16, 14, 20);
      const res1 = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: slot1.toISOString(),
        });
      paderuAppointmentId = res1.body.data.appointment.appointmentId;

      // 2. Appointment requested directly by Medical Officer Dr. Ananya (moPaderuId)
      const slot2 = getFutureTestDate(16, 14, 40);
      const res2 = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${moPaderuToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: slot2.toISOString(),
        });
      moCreatedAppointmentId = res2.body.data.appointment.appointmentId;
    });

    it('denies confirmation from Hospital Manager of a different hospital (403 Forbidden)', async () => {
      // Chintapalli Hospital Manager tries to confirm Paderu DH appointment
      const res = await request(app)
        .post(`/api/v1/appointments/${paderuAppointmentId}/confirm`)
        .set('Authorization', `Bearer ${adminChintapalliToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_HOSPITAL_MISMATCH');
    });

    it('denies confirmation from Medical Officer of a different hospital (403 Forbidden)', async () => {
      // Chintapalli MO tries to confirm Paderu DH appointment
      const res = await request(app)
        .post(`/api/v1/appointments/${paderuAppointmentId}/confirm`)
        .set('Authorization', `Bearer ${moChintapalliToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_HOSPITAL_MISMATCH');
    });

    it('strictly blocks self-confirmation: requester cannot confirm their own appointment (403)', async () => {
      // Dr. Ananya requested moCreatedAppointmentId; she now attempts to confirm it herself
      const res = await request(app)
        .post(`/api/v1/appointments/${moCreatedAppointmentId}/confirm`)
        .set('Authorization', `Bearer ${moPaderuToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SELF_CONFIRMATION_BLOCKED');
      expect(res.body.error.message).toContain('requester cannot confirm their own appointment');
    });

    it('denies confirmation attempt by frontline ASHA worker (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/appointments/${paderuAppointmentId}/confirm`)
        .set('Authorization', `Bearer ${ashaToken}`);

      expect(res.status).toBe(403);
    });

    it('denies confirmation attempt by patient (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/appointments/${paderuAppointmentId}/confirm`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
    });

    it('allows destination Hospital Manager to confirm appointment', async () => {
      const res = await request(app)
        .post(`/api/v1/appointments/${paderuAppointmentId}/confirm`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.appointment.status).toBe('confirmed');
      expect(res.body.data.appointment.confirmedBy.userId).toBe(adminPaderuId);

      // Verify Notification via Phase 5 core shows SMS and email as BLOCKED
      expect(res.body.data.notification).toBeDefined();
      expect(res.body.data.notification.smsBlocked).toBe(true);
      expect(res.body.data.notification.emailBlocked).toBe(true);
    });

    it('allows destination Medical Officer (who is not the requester) to confirm another appointment', async () => {
      // Dr. Ananya confirms the appointment that was requested by ASHA
      const slot = getFutureTestDate(17, 10, 20);
      const reqRes = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: slot.toISOString(),
        });
      const aptId = reqRes.body.data.appointment.appointmentId;

      const confirmRes = await request(app)
        .post(`/api/v1/appointments/${aptId}/confirm`)
        .set('Authorization', `Bearer ${moPaderuToken}`);

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.appointment.status).toBe('confirmed');
      expect(confirmRes.body.data.appointment.confirmedBy.userId).toBe(moPaderuId);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Rescheduling Lifecycle & Conflict Re-Check
  // --------------------------------------------------------------------------
  describe('6. Rescheduling Lifecycle & Conflict Re-Check', () => {
    let testAptId: string;
    let existingBookedStart: Date;

    beforeAll(async () => {
      const slot1 = getFutureTestDate(18, 11, 0);
      const res1 = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: slot1.toISOString(),
        });
      testAptId = res1.body.data.appointment.appointmentId;

      // Create another booked appointment to test conflict during reschedule
      existingBookedStart = getFutureTestDate(18, 11, 20);
      await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId: 'usr_pat_conflict_marker',
          destinationHospitalId: hospPaderuId,
          slotStartTime: existingBookedStart.toISOString(),
        });
    });

    it('rejects rescheduling to a slot already occupied by another patient (409 Conflict)', async () => {
      const res = await request(app)
        .post(`/api/v1/appointments/${testAptId}/reschedule`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          newSlotStartTime: existingBookedStart.toISOString(),
          reason: 'Patient requested time shift',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SLOT_CONFLICT');
    });

    it('successfully reschedules to an open slot and records reschedulingHistory', async () => {
      const openSlot = getFutureTestDate(18, 15, 0);

      const res = await request(app)
        .post(`/api/v1/appointments/${testAptId}/reschedule`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          newSlotStartTime: openSlot.toISOString(),
          reason: 'Patient tribal transportation delayed on agency ghat road',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.appointment.status).toBe('rescheduled');
      expect(res.body.data.appointment.reschedulingHistory.length).toBe(1);
      expect(res.body.data.appointment.reschedulingHistory[0].reason).toContain('ghat road');

      // Notification returned with SMS and email BLOCKED
      expect(res.body.data.notification.smsBlocked).toBe(true);
      expect(res.body.data.notification.emailBlocked).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Cancellation & Slot Freeing
  // --------------------------------------------------------------------------
  describe('7. Cancellation & Slot Availability Restoration', () => {
    let cancelAptId: string;
    let cancelledSlotStart: Date;

    beforeAll(async () => {
      cancelledSlotStart = getFutureTestDate(19, 10, 40);
      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: cancelledSlotStart.toISOString(),
        });
      cancelAptId = res.body.data.appointment.appointmentId;
    });

    it('successfully cancels appointment with reason', async () => {
      const res = await request(app)
        .post(`/api/v1/appointments/${cancelAptId}/cancel`)
        .set('Authorization', `Bearer ${adminPaderuToken}`)
        .send({
          reason: 'Patient relocated to regional headquarters',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.appointment.status).toBe('cancelled');
      expect(res.body.data.appointment.cancellation.reason).toBe(
        'Patient relocated to regional headquarters'
      );
    });

    it('freed slot can now be booked by another patient without conflict', async () => {
      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId: 'usr_pat_new_beneficiary',
          destinationHospitalId: hospPaderuId,
          slotStartTime: cancelledSlotStart.toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.appointment.status).toBe('requested');
    });
  });

  // --------------------------------------------------------------------------
  // 8. Clinical Check-In & Completion Workflow
  // --------------------------------------------------------------------------
  describe('8. Check-in and Completion Flow', () => {
    let completeAptId: string;

    beforeAll(async () => {
      const slot = getFutureTestDate(20, 11, 40);
      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          patientId,
          destinationHospitalId: hospPaderuId,
          slotStartTime: slot.toISOString(),
        });
      completeAptId = res.body.data.appointment.appointmentId;

      // Confirm it first
      await request(app)
        .post(`/api/v1/appointments/${completeAptId}/confirm`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);
    });

    it('checks in patient for confirmed consultation', async () => {
      const res = await request(app)
        .post(`/api/v1/appointments/${completeAptId}/check-in`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.appointment.status).toBe('checked_in');
    });

    it('marks consultation appointment as completed', async () => {
      const res = await request(app)
        .post(`/api/v1/appointments/${completeAptId}/complete`)
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.appointment.status).toBe('completed');
    });
  });

  // --------------------------------------------------------------------------
  // 9. Append-Only Audit Trail Verification
  // --------------------------------------------------------------------------
  describe('9. Append-Only Audit Trail Evidence', () => {
    it('verifies all appointment lifecycle actions are immutably logged in audit collection', async () => {
      const actions = [
        'appointment.requested',
        'appointment.confirmed',
        'appointment.rescheduled',
        'appointment.cancelled',
      ];

      for (const action of actions) {
        const log = await AuditLog.findOne({ action, resourceType: 'appointment' });
        expect(log).toBeDefined();
        expect(log?.action).toBe(action);
      }
    });
  });
});
