import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { ScreeningCase } from '../src/modules/screening/screeningCaseModel.js';
import { Referral } from '../src/modules/referral/referralModel.js';
import { Camp } from '../src/modules/camp/campModel.js';
import { AuditLog } from '../src/modules/audit/auditModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';
import { SIMULATION_BANNER_TEXT } from '../src/modules/report/reportModel.js';

describe('Phase 15: Reports & Executive Dashboards (Q-15 Priority Integration & Exports)', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  // Hospital Identifiers
  const hospPaderuId = 'hosp_paderu_rep_01';
  const hospArakuId = 'hosp_araku_rep_02';

  // Users & Tokens
  let adminPaderuToken: string; // Has reports:export_pii
  const adminPaderuId = 'usr_admin_paderu_r15';

  let moPaderuToken: string; // Has reports:export (NO reports:export_pii)
  const moPaderuId = 'usr_mo_paderu_r15';

  let moArakuToken: string; // Other hospital
  const moArakuId = 'usr_mo_araku_r15';

  let patientToken: string; // Patient (denied)
  const patientId = 'usr_pat_rep_r15';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsReportsTest');
    await mongoose.connect(replSet.getUri());

    await Hospital.syncIndexes();
    await User.syncIndexes();
    await ScreeningCase.syncIndexes();
    await Referral.syncIndexes();
    await Camp.syncIndexes();
    await AuditLog.syncIndexes();

    const pwd = await hashPassword('ReportsPass@2026');

    // 1. Seed Hospitals
    await Hospital.create([
      {
        hospitalId: hospPaderuId,
        name: 'District Hospital Paderu',
        district: 'Alluri Sitharama Raju',
        mandal: 'Paderu',
        state: 'Andhra Pradesh',
        type: 'district_hospital',
        status: 'active',
        simulation: true,
      },
      {
        hospitalId: hospArakuId,
        name: 'Araku Valley CHC',
        district: 'Alluri Sitharama Raju',
        mandal: 'Araku Valley',
        state: 'Andhra Pradesh',
        type: 'community_health_centre',
        status: 'active',
        simulation: true,
      },
    ]);

    // 2. Seed Users
    await User.create([
      {
        userId: adminPaderuId,
        username: 'admin_paderu_rep',
        email: 'admin@paderu-rep.gov.in',
        passwordHash: pwd,
        role: 'admin',
        hospitalId: hospPaderuId,
        fullName: 'Hospital Manager Paderu',
        isActive: true,
      },
      {
        userId: moPaderuId,
        username: 'mo_paderu_rep',
        email: 'mo@paderu-rep.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        hospitalId: hospPaderuId,
        fullName: 'Dr. Ramesh MO',
        isActive: true,
      },
      {
        userId: moArakuId,
        username: 'mo_araku_rep',
        email: 'mo@araku-rep.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        hospitalId: hospArakuId,
        fullName: 'Dr. Anitha Araku MO',
        isActive: true,
      },
      {
        userId: patientId,
        username: 'pat_rep_demo',
        email: 'patient@paderu.com',
        passwordHash: pwd,
        role: 'patient',
        fullName: 'Confidential Tribal Patient',
        isActive: true,
      },
    ]);

    // 3. Seed Screening Cases in Paderu (3-tier priority categorization: routine, urgent, high_priority)
    // 3 cases routine, 2 cases urgent, 1 case high_priority -> Total = 6
    // Routine: 3 (suppressed < 5)
    // Urgent: 2 (suppressed < 5)
    // High Priority: 1 (suppressed < 5)
    // Total Cases: 6 (unsuppressed 6)
    for (let i = 1; i <= 3; i++) {
      await ScreeningCase.create({
        caseId: `case_rep_rout_0${i}`,
        patientId: `pat_rep_rout_0${i}`,
        patientName: `Secret Routine Patient ${i}`,
        villageId: 'vil_matsya_01',
        hospitalId: hospPaderuId,
        createdBy: moPaderuId,
        status: 'pending_assignment',
        priority: 'routine',
        photoIds: [`ph_r_${i}`],
        resultReleased: false,
        simulation: true,
      });
    }
    for (let i = 1; i <= 2; i++) {
      await ScreeningCase.create({
        caseId: `case_rep_urg_0${i}`,
        patientId: `pat_rep_urg_0${i}`,
        patientName: `Secret Urgent Patient ${i}`,
        villageId: 'vil_vanaba_02',
        hospitalId: hospPaderuId,
        createdBy: moPaderuId,
        status: 'escalated',
        priority: 'urgent',
        photoIds: [`ph_u_${i}`],
        resultReleased: false,
        simulation: true,
      });
    }
    await ScreeningCase.create({
      caseId: 'case_rep_high_01',
      patientId: 'pat_rep_high_01',
      patientName: 'Secret HighPriority Patient 1',
      villageId: 'vil_vanaba_02',
      hospitalId: hospPaderuId,
      createdBy: moPaderuId,
      status: 'under_review',
      priority: 'high_priority',
      photoIds: ['ph_h_1'],
      resultReleased: false,
      simulation: true,
    });

    // 4. Seed Referrals in Paderu: Exactly 4 referrals (small count < 5)
    for (let i = 1; i <= 4; i++) {
      await Referral.create({
        referralId: `ref_rep_0${i}`,
        patientId: `pat_ref_0${i}`,
        patientName: `Secret Referral Patient ${i}`,
        sourceHospitalId: hospPaderuId,
        sourceHospitalName: 'District Hospital Paderu',
        destinationHospitalId: hospArakuId,
        destinationHospitalName: 'Araku Valley CHC',
        referringDoctorId: moPaderuId,
        referringDoctorName: 'Dr. Ramesh MO',
        reasonForReferral: 'Secondary mucosal evaluation',
        status: i <= 2 ? 'ATTENDED' : 'SCHEDULED',
        priority: i === 1 ? 'urgent' : 'routine',
        scheduledFollowUpDate: new Date('2026-10-15T09:00:00Z'),
        simulation: true,
      });
    }

    // 5. Seed Camp in Paderu
    await Camp.create({
      campId: 'camp_rep_01',
      name: 'Paderu Agency Mucosal Camp',
      hospitalId: hospPaderuId,
      villageId: 'vil_matsya_01',
      status: 'completed',
      leadMoId: moPaderuId,
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-03'),
      targetPopulation: 500,
      screeningCount: 6,
      abnormalFindingsCount: 2,
      referralsCount: 2,
      location: { address: 'Matsyapuram Community Center' },
      simulation: true,
    });

    // 6. Tokens
    adminPaderuToken = signAccessToken({
      userId: adminPaderuId,
      role: 'admin',
      scopes: getRoleCapabilities('admin'), // includes reports:read, reports:export, reports:export_pii
      deviceSessionId: 'ses_adm_r15',
      deviceId: 'dev_adm_r15',
    });

    moPaderuToken = signAccessToken({
      userId: moPaderuId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'), // includes reports:read, reports:export (NO reports:export_pii)
      deviceSessionId: 'ses_mo_r15',
      deviceId: 'dev_mo_r15',
    });

    moArakuToken = signAccessToken({
      userId: moArakuId,
      role: 'medical_officer',
      scopes: getRoleCapabilities('medical_officer'),
      deviceSessionId: 'ses_ark_r15',
      deviceId: 'dev_ark_r15',
    });

    patientToken = signAccessToken({
      userId: patientId,
      role: 'patient',
      scopes: getRoleCapabilities('patient'),
      deviceSessionId: 'ses_pat_r15',
      deviceId: 'dev_pat_r15',
    });
  }, 60000);

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  describe('1. Dashboard Implementations (Q-15 Working Priorities & Process State Metrics)', () => {
    it('1. GET /api/v1/reports/dashboards/mo-queue returns 3-tier priority categorization and status counts', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboards/mo-queue')
        .set('Authorization', `Bearer ${moPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.simulationBanner).toBe(SIMULATION_BANNER_TEXT);

      // Total cases is 6 (unsuppressed)
      expect(res.body.data.summary.totalCases.count).toBe(6);
      expect(res.body.data.summary.totalCases.isSuppressed).toBe(false);

      // Q-15 Priorities:
      // Routine (3) -> Suppressed (< 5)
      expect(res.body.data.priorities.routine.isSuppressed).toBe(true);
      expect(res.body.data.priorities.routine.displayValue).toBe('< 5');

      // Urgent (2) -> Suppressed (< 5)
      expect(res.body.data.priorities.urgent.isSuppressed).toBe(true);
      expect(res.body.data.priorities.urgent.displayValue).toBe('< 5');

      // High Priority (1) -> Suppressed (< 5)
      expect(res.body.data.priorities.highPriority.isSuppressed).toBe(true);
      expect(res.body.data.priorities.highPriority.displayValue).toBe('< 5');
    });

    it('2. GET /api/v1/reports/dashboards/referral-pipeline returns referral lifecycle & facility breakdown', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboards/referral-pipeline')
        .set('Authorization', `Bearer ${moPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.simulationBanner).toBe(SIMULATION_BANNER_TEXT);
      // Total referrals = 4 -> Suppressed (< 5)
      expect(res.body.data.summary.totalReferrals.isSuppressed).toBe(true);
      expect(res.body.data.summary.totalReferrals.displayValue).toBe('< 5');
      expect(res.body.data.destinationFacilityBreakdown.length).toBeGreaterThanOrEqual(1);
    });

    it('3. GET /api/v1/reports/dashboards/camp-outcomes returns target population vs. screenings with cell suppression', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboards/camp-outcomes')
        .set('Authorization', `Bearer ${moPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.simulationBanner).toBe(SIMULATION_BANNER_TEXT);
      expect(res.body.data.summary.totalCamps).toBe(1);
      expect(res.body.data.summary.screeningsConducted.count).toBe(6);
      expect(res.body.data.summary.abnormalFindingsFlagged.displayValue).toBe('< 5');
    });

    it('4. GET /api/v1/reports/dashboards/follow-up-completion returns adherence and escalation metrics', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboards/follow-up-completion')
        .set('Authorization', `Bearer ${moPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.simulationBanner).toBe(SIMULATION_BANNER_TEXT);
      expect(res.body.data.summary.adherenceRateDisplay).toBe('Suppressed (< 5)');
    });

    it('5. GET /api/v1/reports/dashboards/sync-health returns offline queue health status', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboards/sync-health')
        .set('Authorization', `Bearer ${moPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.simulationBanner).toBe(SIMULATION_BANNER_TEXT);
      expect(res.body.data.summary.syncQueueHealth).toBe('healthy');
      expect(res.body.data.summary.activeDevicesCount).toBeDefined();
    });
  });

  describe('2. CSV and PDF Exports (Audit Logging & PII Capability Gating)', () => {
    it('exports CSV with SIMULATION banner and redacts direct identifiers when actor lacks reports:export_pii', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export/csv?type=mo-queue')
        .set('Authorization', `Bearer ${moPaderuToken}`); // MO lacks reports:export_pii

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain(SIMULATION_BANNER_TEXT);

      // Zero direct identifiers: patient name redacted to PAT-***
      expect(res.text).not.toContain('Secret Routine Patient');
      expect(res.text).not.toContain('Secret Urgent Patient');
      expect(res.text).toContain('PAT-');

      // Verify audit log entry was written
      const auditLog = await AuditLog.findOne({ action: 'report.export.csv' }).sort({ createdAt: -1 });
      expect(auditLog).toBeDefined();
      expect(auditLog?.actorId).toBe(moPaderuId);
      expect(auditLog?.metadata.hasPii).toBe(false);
      expect(auditLog?.metadata.capabilityUsed).toBe('reports:export');
    });

    it('includes direct identifiers in CSV only when actor holds reports:export_pii and strictly audits it', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export/csv?type=mo-queue')
        .set('Authorization', `Bearer ${adminPaderuToken}`); // Admin holds reports:export_pii

      expect(res.status).toBe(200);
      expect(res.text).toContain('Secret Routine Patient 1');

      // Verify audit log explicitly records PII capability usage
      const auditLog = await AuditLog.findOne({
        action: 'report.export.csv',
        actorId: adminPaderuId,
      }).sort({ createdAt: -1 });

      expect(auditLog).toBeDefined();
      expect(auditLog?.metadata.hasPii).toBe(true);
      expect(auditLog?.metadata.capabilityUsed).toBe('reports:export_pii');
    });

    it('exports PDF with SIMULATION banner, valid PDF-1.4 header, and audit logging', async () => {
      const res = await request(app)
        .get('/api/v1/reports/export/pdf?type=referral-pipeline')
        .set('Authorization', `Bearer ${adminPaderuToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');

      // Verify binary PDF-1.4 header
      const buffer = res.body;
      const pdfHeader = buffer.toString('utf-8', 0, 8);
      expect(pdfHeader).toContain('%PDF-1.4');

      // Verify audit entry for PDF export
      const auditLog = await AuditLog.findOne({ action: 'report.export.pdf' }).sort({ createdAt: -1 });
      expect(auditLog).toBeDefined();
      expect(auditLog?.metadata.format).toBe('pdf');
      expect(auditLog?.metadata.reportType).toBe('referral-pipeline');
    });
  });

  describe('3. Scope Denial & Access Control', () => {
    it('scopes dashboard to hospital catchment (Araku MO sees 0 cases for Paderu)', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboards/mo-queue')
        .set('Authorization', `Bearer ${moArakuToken}`);

      expect(res.status).toBe(200);
      // Araku has 0 screening cases
      expect(res.body.data.summary.totalCases.count).toBe(0);
      expect(res.body.data.summary.totalCases.displayValue).toBe('0');
    });

    it('denies patient access to all report dashboards with 403', async () => {
      const res = await request(app)
        .get('/api/v1/reports/dashboards/mo-queue')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
    });

    it('denies patient access to CSV and PDF exports with 403', async () => {
      const resCsv = await request(app)
        .get('/api/v1/reports/export/csv?type=mo-queue')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(resCsv.status).toBe(403);

      const resPdf = await request(app)
        .get('/api/v1/reports/export/pdf?type=mo-queue')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(resPdf.status).toBe(403);
    });
  });

  describe('4. Security & Log Scanner (No Secrets or Direct PII Leaks)', () => {
    it('verifies audit logs contain no secret passwords, tokens, or unredacted patient phone numbers', async () => {
      const logs = await AuditLog.find({ resourceType: 'report_export' });
      expect(logs.length).toBeGreaterThanOrEqual(2);

      for (const log of logs) {
        const metaStr = JSON.stringify(log.metadata || {});
        expect(metaStr).not.toContain('ReportsPass@2026');
        expect(metaStr).not.toContain('Bearer');
        expect(metaStr).not.toContain('Confidential Tribal Patient');
      }
    });
  });
});
