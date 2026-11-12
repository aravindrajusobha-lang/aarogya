import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
import { Consultation } from '../src/modules/consultation/consultationModel.js';
import { DailyProviderConfig } from '../src/modules/consultation/dailyProviderConfigModel.js';
import { ConsultationNote } from '../src/modules/teleconsultation/teleconsultationModel.js';
import { Notification } from '../src/modules/notification/notificationModel.js';
import { Patient } from '../src/modules/patient/patientModel.js';
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

  describe('9. Appointment video invite gating', () => {
    it('requires doctor confirmation and the patient-specific invite to join the demo room', async () => {
      const slot = getFutureTestDate(22, 10, 0);
      const booking = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({ patientId, destinationHospitalId: hospPaderuId, slotStartTime: slot.toISOString(), type: 'clinical_consultation' });
      const appointmentId = booking.body.data.appointment.appointmentId;

      const prematureInvite = await request(app)
        .post(`/api/v1/appointments/${appointmentId}/video-invite`)
        .set('Authorization', `Bearer ${moPaderuToken}`);
      expect(prematureInvite.status).toBe(409);
      expect(prematureInvite.body.error.code).toBe('APPOINTMENT_NOT_CONFIRMED');

      await request(app)
        .post(`/api/v1/appointments/${appointmentId}/confirm`)
        .set('Authorization', `Bearer ${moPaderuToken}`);
      const inviteResponse = await request(app)
        .post(`/api/v1/appointments/${appointmentId}/video-invite`)
        .set('Authorization', `Bearer ${moPaderuToken}`);
      expect(inviteResponse.status).toBe(201);
      expect(inviteResponse.body.data.videoStatus).toBe('DEMO');
      const inviteToken = inviteResponse.body.data.token;
      const consultationLink = inviteResponse.body.data.link;
      expect(consultationLink).toContain(`/appointment-consultation/${appointmentId}?invite=${inviteToken}`);
      const inviteNotification = await Notification.findOne({ recipientId: patientId, link: consultationLink });
      expect(inviteNotification).not.toBeNull();
      expect(inviteNotification?.deliveryStatus.find((delivery) => delivery.channel === 'in_app')?.delivered).toBe(true);
      const smsDelivery = inviteNotification?.deliveryStatus.find((delivery) => delivery.channel === 'sms');
      expect(smsDelivery?.delivered).toBe(false);
      expect(['BLOCKED_STUB', 'skipped_by_preference']).toContain(smsDelivery?.status);
      const patientInbox = await request(app)
        .get('/api/v1/notifications?limit=50')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(patientInbox.status).toBe(200);
      expect(patientInbox.body.data.notifications.some((notification: any) => notification.link === consultationLink)).toBe(true);
      const stored = await Appointment.findOne({ appointmentId });
      expect(stored?.videoInvite?.tokenHash).not.toBe(inviteToken);
      expect(new Date(inviteResponse.body.data.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(30 * 60 * 1000);

      const directJoin = await request(app)
        .post(`/api/v1/teleconsultation/rooms/${appointmentId}/join`)
        .set('Authorization', `Bearer ${patientToken}`);
      expect(directJoin.status).toBe(403);

      const verified = await request(app)
        .post(`/api/v1/appointments/${appointmentId}/video-invite/verify`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ token: inviteToken });
      expect(verified.status).toBe(200);

      const wrongToken = await request(app)
        .post(`/api/v1/appointments/${appointmentId}/video-invite/verify`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ token: `${inviteToken}wrong` });
      expect(wrongToken.status).toBe(403);

      const joined = await request(app)
        .post(`/api/v1/teleconsultation/rooms/${appointmentId}/join`)
        .set('Authorization', `Bearer ${patientToken}`)
        .set('X-Consultation-Invite', inviteToken);
      expect(joined.status).toBe(200);

      stored!.videoInvite!.expiresAt = new Date(Date.now() - 1000);
      await stored!.save();
      const afterExpiry = await request(app)
        .post(`/api/v1/teleconsultation/rooms/${appointmentId}/join`)
        .set('Authorization', `Bearer ${patientToken}`)
        .set('X-Consultation-Invite', inviteToken);
      expect(afterExpiry.status).toBe(403);
    });
  });

  describe('10. Daily appointment consultation access', () => {
    it('shows assigned appointment requests even when their slot is on a future date', async () => {
      const appointmentId = 'apt_doctor_pending_future_01';
      const slotStartTime = getFutureTestDate(20);
      await Appointment.create({ appointmentId, patientId, patientName: 'Synthetic Patient', destinationHospitalId: hospPaderuId, assignedDoctorId: moPaderuId, slotStartTime, slotEndTime: new Date(slotStartTime.getTime() + 20 * 60_000), durationMinutes: 20, status: 'requested', type: 'clinical_consultation', requestedBy: { userId: patientId, role: 'patient' }, reschedulingHistory: [], offlineQueued: false });
      const response = await request(app).get('/api/v1/consultations/doctor/appointments').set('Authorization', `Bearer ${moPaderuToken}`);
      expect(response.status).toBe(200);
      expect(response.body.data.appointments).toEqual(expect.arrayContaining([expect.objectContaining({ appointmentId, status: 'requested' })]));
    });

    it('keeps an accepted future appointment visible so the doctor can send its video link', async () => {
      const appointmentId = 'apt_doctor_confirmed_future_01';
      const slotStartTime = getFutureTestDate(21);
      await Appointment.create({ appointmentId, patientId, patientName: 'Synthetic Patient', destinationHospitalId: hospPaderuId, assignedDoctorId: moPaderuId, slotStartTime, slotEndTime: new Date(slotStartTime.getTime() + 20 * 60_000), durationMinutes: 20, status: 'confirmed', type: 'clinical_consultation', requestedBy: { userId: patientId, role: 'patient' }, reschedulingHistory: [], offlineQueued: false });
      const response = await request(app).get('/api/v1/consultations/doctor/appointments').set('Authorization', `Bearer ${moPaderuToken}`);
      expect(response.status).toBe(200);
      expect(response.body.data.appointments).toEqual(expect.arrayContaining([expect.objectContaining({ appointmentId, status: 'confirmed' })]));
    });

    it('stores prescriptions under the patient ID with authoritative names and denies another facility', async () => {
      const clinicalPatientId = 'PATIENT-RECORD-TEST';
      await Patient.create({ patientId: clinicalPatientId, fullName: 'Synthetic Record Patient', gender: 'other', ageEstimated: 30, villageId: 'test-village', villageName: 'Test village', mandal: 'Paderu', originalAddressText: 'Test address', hospitalId: hospPaderuId, registeredBy: moPaderuId });
      const issued = await request(app).post('/api/v1/prescriptions').set('Authorization', `Bearer ${moPaderuToken}`).send({ patientId: clinicalPatientId, patientName: 'Untrusted client name', mutationId: crypto.randomUUID(), clinicalObservations: 'Clinician authored note', clinicalImpression: 'For clinician follow-up', medicines: [{ medicineName: 'Synthetic test medicine', dosage: 'As entered by test clinician', frequency: 'Test schedule', durationDays: 1 }] });
      expect(issued.status).toBe(201);
      expect(issued.body.data.prescription.patientName).toBe('Synthetic Record Patient');
      expect(issued.body.data.prescription.doctorName).toBe('Dr. Ananya MO Paderu');
      expect(issued.body.data.prescription.sha256).toMatch(/^[a-f0-9]{64}$/);
      const record = await request(app).get(`/api/v1/consultations/doctor/patients/${clinicalPatientId}/records`).set('Authorization', `Bearer ${moPaderuToken}`);
      expect(record.status).toBe(200);
      expect(record.body.data.prescriptions).toHaveLength(1);
      const forbidden = await request(app).get(`/api/v1/consultations/doctor/patients/${clinicalPatientId}/records`).set('Authorization', `Bearer ${moChintapalliToken}`);
      expect(forbidden.status).toBe(404);
      const forbiddenRx = await request(app).get(`/api/v1/prescriptions/${issued.body.data.prescription.prescriptionId}`).set('Authorization', `Bearer ${moChintapalliToken}`);
      expect(forbiddenRx.status).toBe(403);
    });

    it('lists verified doctors and free slot counts without requiring a hospital filter', async () => {
      const date = getFutureTestDate(12).toISOString().slice(0, 10);
      const before = await request(app).get(`/api/v1/consultations/availability?date=${date}`).set('Authorization', `Bearer ${patientToken}`);
      expect(before.body.data.doctors.some((doctor: any) => doctor.userId === moPaderuId)).toBe(false);
      const mutationId = crypto.randomUUID();
      const published = await request(app).post('/api/v1/consultations/doctor/availability').set('Authorization', `Bearer ${moPaderuToken}`).send({ startTime: new Date(`${date}T11:00:00+05:30`).toISOString(), mutationId });
      expect(published.status).toBe(201);
      const replay = await request(app).post('/api/v1/consultations/doctor/availability').set('Authorization', `Bearer ${moPaderuToken}`).send({ startTime: new Date(`${date}T11:00:00+05:30`).toISOString(), mutationId });
      expect(replay.status).toBe(200);
      expect(replay.body.data.slot._id).toBe(published.body.data.slot._id);
      const denied = await request(app).post('/api/v1/consultations/doctor/availability').set('Authorization', `Bearer ${patientToken}`).send({ startTime: new Date(`${date}T11:20:00+05:30`).toISOString(), mutationId: crypto.randomUUID() });
      expect(denied.status).toBe(403);
      const response = await request(app).get(`/api/v1/consultations/availability?date=${date}`).set('Authorization', `Bearer ${patientToken}`);
      expect(response.status).toBe(200);
      expect(response.body.data.doctors.some((doctor: any) => doctor.userId === moPaderuId && doctor.availableSlotsCount > 0)).toBe(true);
      const booking = await request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${patientToken}`).send({ patientId, destinationHospitalId: hospPaderuId, assignedDoctorId: moPaderuId, consultationMode: 'online', slotStartTime: published.body.data.slot.startTime, mutationId: crypto.randomUUID() });
      expect(booking.status).toBe(201);
      expect(booking.body.data.appointment.assignedDoctorId).toBe(moPaderuId);
      const unpublished = await request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${patientToken}`).send({ patientId, destinationHospitalId: hospPaderuId, assignedDoctorId: moPaderuId, consultationMode: 'offline', slotStartTime: new Date(`${date}T12:00:00+05:30`).toISOString(), mutationId: crypto.randomUUID() });
      expect(unpublished.status).toBe(400);

    });

    it('lets the doctor send a private Daily link after confirmation, then rejoin after the patient opens it', async () => {
      const oldKey = process.env.DAILY_API_KEY; const oldDomain = process.env.DAILY_DOMAIN;
      const oldClientOrigin = process.env.CLIENT_ORIGIN;
      process.env.DAILY_API_KEY = 'server-only-test-key'; process.env.DAILY_DOMAIN = 'test.daily.co';
      delete process.env.CLIENT_ORIGIN;
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'room-test', url: 'https://test.daily.co/room-test' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'patient-daily-token' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'doctor-daily-token' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'room-test' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      const oldFetch = global.fetch; global.fetch = fetchMock as any;
      try {
        const appointmentId = 'apt_daily_consultation_01';
        await Appointment.create({ appointmentId, patientId, patientName: 'Synthetic Patient', destinationHospitalId: hospPaderuId, assignedDoctorId: moPaderuId, slotStartTime: new Date(Date.now()-60_000), slotEndTime: new Date(Date.now()+19*60_000), durationMinutes: 20, status: 'confirmed', type: 'clinical_consultation', requestedBy: { userId: patientId, role: 'patient' }, reschedulingHistory: [], offlineQueued: false });
        const linkResponse = await request(app).post(`/api/v1/consultations/${appointmentId}/send-link`).set('Authorization', `Bearer ${moPaderuToken}`).set('Origin', 'http://127.0.0.1:5174');
        expect(linkResponse.status).toBe(201); expect(linkResponse.body.data.videoStatus).toBe('DAILY_CONFIGURED');
        expect(linkResponse.body.data.link).toMatch(/^http:\/\/127\.0\.0\.1:5174\/#\/consultation\/join\//);
        const raw = new URL(linkResponse.body.data.link).hash.split('/').pop()!;
        const consultation = await Consultation.findOne({ appointmentId });
        expect(consultation?.tokenHash).not.toBe(raw); expect(consultation?.status).toBe('LINK_SENT');
        const waitingDoctorJoin = await request(app).post(`/api/v1/consultations/${appointmentId}/doctor-join`).set('Authorization', `Bearer ${moPaderuToken}`);
        expect(waitingDoctorJoin.status).toBe(409);
        const wrongDoctor = await request(app).post(`/api/v1/consultations/join/${raw}`).set('Authorization', `Bearer ${moChintapalliToken}`);
        expect(wrongDoctor.status).toBe(403);
        const patientJoin = await request(app).post(`/api/v1/consultations/join/${raw}`).set('Authorization', `Bearer ${patientToken}`);
        expect(patientJoin.status).toBe(200); expect(patientJoin.body.data.meetingToken).toBe('patient-daily-token');
        const doctorJoin = await request(app).post(`/api/v1/consultations/${appointmentId}/doctor-join`).set('Authorization', `Bearer ${moPaderuToken}`);
        expect(doctorJoin.status).toBe(200); expect(doctorJoin.body.data.meetingToken).toBe('doctor-daily-token');
        const started = await request(app).post(`/api/v1/consultations/${appointmentId}/start`).set('Authorization', `Bearer ${moPaderuToken}`);
        expect(started.status).toBe(200); expect(new Date(started.body.data.expiresAt).getTime()-new Date(started.body.data.startedAt).getTime()).toBe(30*60_000);
        const ended = await request(app).post(`/api/v1/consultations/${appointmentId}/end`).set('Authorization', `Bearer ${moPaderuToken}`).send({ notes: 'Follow-up discussion recorded.' });
        expect(ended.status).toBe(200); expect(ended.body.data.status).toBe('COMPLETED');
        const note = await ConsultationNote.findOne({ consultationId: consultation?.consultationId });
        expect(note?.originalNoteText).toBe('Follow-up discussion recorded.'); expect(note?.originalHash).toHaveLength(64);
      } finally { global.fetch = oldFetch; if (oldKey === undefined) delete process.env.DAILY_API_KEY; else process.env.DAILY_API_KEY = oldKey; if (oldDomain === undefined) delete process.env.DAILY_DOMAIN; else process.env.DAILY_DOMAIN = oldDomain; if (oldClientOrigin === undefined) delete process.env.CLIENT_ORIGIN; else process.env.CLIENT_ORIGIN = oldClientOrigin; }
    });
  });

  describe('11. Direct Daily doctor-to-patient calls', () => {
    it('limits patient selection and joining to the calling doctor and invited patient', async () => {
      const oldKey = process.env.DAILY_API_KEY; const oldDomain = process.env.DAILY_DOMAIN;
      process.env.DAILY_API_KEY = 'server-only-test-key'; process.env.DAILY_DOMAIN = 'test.daily.co';
      const directPatientId = 'patient_direct_01'; const directPatientUserId = 'usr_patient_direct_01';
      const foreignPatientId = 'patient_direct_foreign_01';
      const directPatientToken = signAccessToken({ userId: directPatientUserId, role: 'patient', capabilities: getRoleCapabilities('patient') });
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { rooms: [] } }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'direct-room-test', url: 'https://test.daily.co/direct-room-test' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'patient-direct-token' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'doctor-direct-token' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'direct-reject-room', url: 'https://test.daily.co/direct-reject-room' }) });
      const oldFetch = global.fetch; global.fetch = fetchMock as any;
      try {
        await User.create({ userId: directPatientUserId, username: 'patient_direct_01', patientId: directPatientId, fullName: 'Direct Call Patient', role: 'patient', hospitalId: hospPaderuId, verificationStatus: 'verified', passwordHash: 'test-hash', mfaEnabled: false });
        await User.collection.updateOne({ userId: directPatientUserId }, { $unset: { status: '', verificationStatus: '' } });
        await User.create({ userId: 'usr_patient_direct_foreign', username: 'patient_direct_foreign', patientId: foreignPatientId, fullName: 'Foreign Facility Patient', role: 'patient', hospitalId: hospChintapalliId, verificationStatus: 'verified', passwordHash: 'test-hash', mfaEnabled: false });
        await Patient.create({ patientId: directPatientId, fullName: 'Direct Call Patient', name: 'Direct Call Patient', gender: 'female', ageEstimated: 42, villageId: 'village_direct_01', villageName: 'Direct Village', mandal: 'Paderu', district: 'Alluri Sitharama Raju', originalAddressText: 'Direct Village', hospitalId: hospPaderuId, registeredBy: moPaderuId, registeredAt: new Date(), isDuplicateCandidate: false, duplicateReviewStatus: 'none', matchReasons: [], history: [], simulation: true });
        await Patient.create({ patientId: foreignPatientId, fullName: 'Foreign Facility Patient', name: 'Foreign Facility Patient', gender: 'female', ageEstimated: 38, villageId: 'village_foreign_01', villageName: 'Foreign Village', mandal: 'Chintapalli', district: 'Alluri Sitharama Raju', originalAddressText: 'Foreign Village', hospitalId: hospChintapalliId, registeredBy: moChintapalliId, registeredAt: new Date(), isDuplicateCandidate: false, duplicateReviewStatus: 'none', matchReasons: [], history: [], simulation: true });
        const providerStatus = await request(app).get('/api/v1/consultations/provider-status').set('Authorization', `Bearer ${moPaderuToken}`);
        expect(providerStatus.status).toBe(200); expect(providerStatus.body.data.liveVideo.status).toBe('CONNECTED');
        const contacts = await request(app).get('/api/v1/consultations/direct-calls/patients').set('Authorization', `Bearer ${moPaderuToken}`);
        expect(contacts.status).toBe(200); expect(contacts.body.data.patients).toEqual(expect.arrayContaining([expect.objectContaining({ patientId: directPatientId })]));
        expect(contacts.body.data.patients).not.toEqual(expect.arrayContaining([expect.objectContaining({ patientId: foreignPatientId })]));
        const forbiddenContacts = await request(app).get('/api/v1/consultations/direct-calls/patients').set('Authorization', `Bearer ${patientToken}`);
        expect(forbiddenContacts.status).toBe(403);
        const foreignCall = await request(app).post('/api/v1/consultations/direct-calls').set('Authorization', `Bearer ${moPaderuToken}`).send({ patientId: foreignPatientId, clientMutationId: '77777777-7777-4777-8777-777777777777' });
        expect(foreignCall.status).toBe(404);
        const createMutationId = '11111111-1111-4111-8111-111111111111';
        const created = await request(app).post('/api/v1/consultations/direct-calls').set('Authorization', `Bearer ${moPaderuToken}`).send({ patientId: directPatientId, clientMutationId: createMutationId });
        expect(created.status).toBe(201); expect(created.body.data.provider).toBe('DAILY');
        const callId = created.body.data.callId;
        const replay = await request(app).post('/api/v1/consultations/direct-calls').set('Authorization', `Bearer ${moPaderuToken}`).send({ patientId: directPatientId, clientMutationId: createMutationId });
        expect(replay.status).toBe(200); expect(replay.body.data.callId).toBe(callId); expect(replay.body.data.idempotentReplay).toBe(true);
        const incoming = await request(app).get('/api/v1/consultations/direct-calls/incoming').set('Authorization', `Bearer ${directPatientToken}`);
        expect(incoming.status).toBe(200); expect(incoming.body.data.calls).toEqual(expect.arrayContaining([expect.objectContaining({ callId, status: 'LINK_SENT' })]));
        const deniedDoctor = await request(app).post(`/api/v1/consultations/direct-calls/${callId}/join`).set('Authorization', `Bearer ${moChintapalliToken}`).send({ clientMutationId: '88888888-8888-4888-8888-888888888888' });
        expect(deniedDoctor.status).toBe(403);
        const wrongPatient = await request(app).post(`/api/v1/consultations/direct-calls/${callId}/join`).set('Authorization', `Bearer ${patientToken}`).send({ clientMutationId: '99999999-9999-4999-8999-999999999999' });
        expect(wrongPatient.status).toBe(403);
        const patientJoin = await request(app).post(`/api/v1/consultations/direct-calls/${callId}/join`).set('Authorization', `Bearer ${directPatientToken}`).send({ clientMutationId: '22222222-2222-4222-8222-222222222222' });
        expect(patientJoin.status).toBe(200); expect(patientJoin.body.data.meetingToken).toBe('patient-direct-token');
        const doctorJoin = await request(app).post(`/api/v1/consultations/direct-calls/${callId}/join`).set('Authorization', `Bearer ${moPaderuToken}`).send({ clientMutationId: '33333333-3333-4333-8333-333333333333' });
        expect(doctorJoin.status).toBe(200); expect(doctorJoin.body.data.meetingToken).toBe('doctor-direct-token');
        const started = await request(app).post(`/api/v1/consultations/direct-calls/${callId}/start`).set('Authorization', `Bearer ${moPaderuToken}`).send({ clientMutationId: '44444444-4444-4444-8444-444444444444' });
        expect(started.status).toBe(200);
        const notes = await request(app).put(`/api/v1/consultations/direct-calls/${callId}/notes`).set('Authorization', `Bearer ${moPaderuToken}`).send({ notes: 'Direct consultation follow-up recorded.', clientMutationId: '55555555-5555-4555-8555-555555555555' });
        expect(notes.status).toBe(200); expect((await ConsultationNote.findOne({ consultationId: callId }))?.originalHash).toHaveLength(64);
        const left = await request(app).post(`/api/v1/consultations/direct-calls/${callId}/leave`).set('Authorization', `Bearer ${directPatientToken}`).send({ clientMutationId: '66666666-6666-4666-8666-666666666666' });
        expect(left.status).toBe(200); expect(left.body.data.status).toBe('COMPLETED');
        const pendingCall = await request(app).post('/api/v1/consultations/direct-calls').set('Authorization', `Bearer ${moPaderuToken}`).send({ patientId: directPatientId, clientMutationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
        expect(pendingCall.status).toBe(201);
        const rejectedCall = await request(app).post(`/api/v1/consultations/direct-calls/${pendingCall.body.data.callId}/reject`).set('Authorization', `Bearer ${directPatientToken}`).send({ clientMutationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
        expect(rejectedCall.status).toBe(200); expect(rejectedCall.body.data.status).toBe('CANCELLED');
      } finally { global.fetch = oldFetch; if (oldKey === undefined) delete process.env.DAILY_API_KEY; else process.env.DAILY_API_KEY = oldKey; if (oldDomain === undefined) delete process.env.DAILY_DOMAIN; else process.env.DAILY_DOMAIN = oldDomain; }
    });
  });

  describe('12. Admin Daily provider configuration', () => {
    it('restricts settings to system admins and encrypts verified credentials at rest', async () => {
      const oldKey = process.env.DAILY_API_KEY; const oldDomain = process.env.DAILY_DOMAIN; const oldEncryptionKey = process.env.VIDEO_CONFIG_ENCRYPTION_KEY;
      delete process.env.DAILY_API_KEY; delete process.env.DAILY_DOMAIN;
      process.env.VIDEO_CONFIG_ENCRYPTION_KEY = 'ab'.repeat(32);
      const systemAdminId = 'usr_system_admin_video_config';
      await User.create({ userId: systemAdminId, username: 'system_admin_video_config', fullName: 'System Admin Video Config', role: 'system_admin', passwordHash: 'test-hash', mfaEnabled: false });
      const systemAdminToken = signAccessToken({ userId: systemAdminId, role: 'system_admin', capabilities: getRoleCapabilities('system_admin') });
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
        .mockResolvedValue({ ok: true, json: async () => ({ data: { rooms: [] } }) });
      const oldFetch = global.fetch; global.fetch = fetchMock as any;
      try {
        const denied = await request(app).put('/api/v1/consultations/admin/video-provider').set('Authorization', `Bearer ${adminPaderuToken}`).send({ apiKey: 'daily-test-secret-key', domain: 'paderu-test.daily.co' });
        expect(denied.status).toBe(403);
        const invalid = await request(app).put('/api/v1/consultations/admin/video-provider').set('Authorization', `Bearer ${systemAdminToken}`).send({ apiKey: 'daily-invalid-test-key', domain: 'paderu-test.daily.co' });
        expect(invalid.status).toBe(502); expect(invalid.body.error.code).toBe('VIDEO_PROVIDER_INVALID_CREDENTIALS');
        expect(await DailyProviderConfig.countDocuments({ provider: 'daily' })).toBe(0);
        const saved = await request(app).put('/api/v1/consultations/admin/video-provider').set('Authorization', `Bearer ${systemAdminToken}`).send({ apiKey: 'daily-test-secret-key', domain: 'https://paderu-test.daily.co/' });
        expect(saved.status).toBe(200); expect(saved.body.data.status).toBe('CONNECTED'); expect(saved.body.data.domain).toBe('paderu-test.daily.co');
        const stored: any = await DailyProviderConfig.findOne({ provider: 'daily' }).select('+encryptedApiKey +iv +authTag').lean();
        expect(stored.encryptedApiKey).not.toContain('daily-test-secret-key'); expect(stored.iv).toBeTruthy(); expect(stored.authTag).toBeTruthy();
        const status = await request(app).get('/api/v1/consultations/admin/video-provider').set('Authorization', `Bearer ${systemAdminToken}`);
        expect(status.status).toBe(200); expect(status.body.data.status).toBe('CONNECTED');
        expect(JSON.stringify(status.body.data)).not.toContain('daily-test-secret-key');
      } finally {
        global.fetch = oldFetch;
        await DailyProviderConfig.deleteOne({ provider: 'daily' });
        if (oldKey === undefined) delete process.env.DAILY_API_KEY; else process.env.DAILY_API_KEY = oldKey;
        if (oldDomain === undefined) delete process.env.DAILY_DOMAIN; else process.env.DAILY_DOMAIN = oldDomain;
        if (oldEncryptionKey === undefined) delete process.env.VIDEO_CONFIG_ENCRYPTION_KEY; else process.env.VIDEO_CONFIG_ENCRYPTION_KEY = oldEncryptionKey;
      }
    });
  });

  describe('Patient dashboard appointment actions', () => {
    it('accepts a doctor response once, scopes it to the assigned doctor, and replays by mutation ID', async () => {
      const appointmentId = 'apt_patient_dashboard_accept_01';
      const slotStartTime = getFutureTestDate(37, 10, 20);
      await Appointment.create({ appointmentId, patientId, patientName: 'Synthetic Patient', destinationHospitalId: hospPaderuId, assignedDoctorId: moPaderuId, slotStartTime, slotEndTime: new Date(slotStartTime.getTime() + 20 * 60_000), durationMinutes: 20, status: 'requested', type: 'clinical_consultation', requestedBy: { userId: patientId, role: 'patient' }, reschedulingHistory: [], offlineQueued: false });

      const denied = await request(app).post(`/api/v1/appointments/${appointmentId}/doctor-response`).set('Authorization', `Bearer ${moChintapalliToken}`).send({ mutationId: 'c1111111-1111-4111-8111-111111111111', decision: 'accept' });
      expect(denied.status).toBe(403);

      const mutationId = 'c2222222-2222-4222-8222-222222222222';
      const accepted = await request(app).post(`/api/v1/appointments/${appointmentId}/doctor-response`).set('Authorization', `Bearer ${moPaderuToken}`).send({ mutationId, decision: 'accept' });
      expect(accepted.status).toBe(200);
      expect(accepted.body.data.status).toBe('confirmed');
      const replay = await request(app).post(`/api/v1/appointments/${appointmentId}/doctor-response`).set('Authorization', `Bearer ${moPaderuToken}`).send({ mutationId, decision: 'accept' });
      expect(replay.status).toBe(200);
      expect(replay.body.data.idempotentReplay).toBe(true);
      expect(await Appointment.countDocuments({ appointmentId })).toBe(1);
    });

    it('records the patient cancellation reason and returns a cached result on replay', async () => {
      const appointmentId = 'apt_patient_dashboard_cancel_01';
      const slotStartTime = getFutureTestDate(38, 11, 20);
      await Appointment.create({ appointmentId, patientId, patientName: 'Synthetic Patient', destinationHospitalId: hospPaderuId, assignedDoctorId: moPaderuId, slotStartTime, slotEndTime: new Date(slotStartTime.getTime() + 20 * 60_000), durationMinutes: 20, status: 'confirmed', type: 'clinical_consultation', requestedBy: { userId: patientId, role: 'patient' }, reschedulingHistory: [], offlineQueued: false });
      const mutationId = 'c3333333-3333-4333-8333-333333333333';
      const body = { reason: 'Schedule conflict', mutationId };
      const cancelled = await request(app).post(`/api/v1/appointments/${appointmentId}/cancel`).set('Authorization', `Bearer ${patientToken}`).send(body);
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.appointment.cancellation.reason).toBe(body.reason);
      const replay = await request(app).post(`/api/v1/appointments/${appointmentId}/cancel`).set('Authorization', `Bearer ${patientToken}`).send(body);
      expect(replay.status).toBe(200);
      expect(replay.body.data.idempotentReplay).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 10. Append-Only Audit Trail Verification
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
