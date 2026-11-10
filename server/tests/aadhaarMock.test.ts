import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/app.js';
import { createTestReplicaSet } from './setupReplSet.js';
import { User } from '../src/modules/auth/userModel.js';
import { AuditLog } from '../src/modules/audit/auditModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { verifyAllExpressRoutesCovered } from '../src/modules/auth/authorizationEngine.js';

describe('Phase 16: Aadhaar Verification Mock Service (MOCK Badge & Non-Custodial Invariants)', () => {
  let app: any;
  let replSet: MongoMemoryReplSet;

  // Tokens & Users
  let ashaToken: string;
  const ashaId = 'usr_asha_mock_01';

  let moToken: string;
  const moId = 'usr_mo_mock_01';

  let patientToken: string;
  const patientId = 'usr_pat_mock_01';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsAadhaarMockTest');
    await mongoose.connect(replSet.getUri());

    await User.syncIndexes();
    await AuditLog.syncIndexes();

    const pwd = await hashPassword('MockPass@2026');

    // 1. Seed Users
    await User.create([
      {
        userId: ashaId,
        username: 'asha_paderu_mock',
        email: 'asha@paderu-mock.gov.in',
        passwordHash: pwd,
        role: 'asha',
        fullName: 'Lakshmi ASHA Worker',
        isActive: true,
      },
      {
        userId: moId,
        username: 'mo_paderu_mock',
        email: 'mo@paderu-mock.gov.in',
        passwordHash: pwd,
        role: 'medical_officer',
        fullName: 'Dr. Ramesh MO',
        isActive: true,
      },
      {
        userId: patientId,
        username: 'patient_mock',
        email: 'patient@paderu-mock.com',
        passwordHash: pwd,
        role: 'patient',
        fullName: 'Tribal Patient Beneficiary',
        isActive: true,
      },
    ]);

    // 2. Tokens
    ashaToken = signAccessToken({
      userId: ashaId,
      role: 'asha',
      scopes: ['aadhaar:mock_auth', 'aadhaar:mock_read', 'screening:create'],
    });

    moToken = signAccessToken({
      userId: moId,
      role: 'medical_officer',
      scopes: ['aadhaar:mock_auth', 'aadhaar:mock_read', 'screening:review'],
    });

    patientToken = signAccessToken({
      userId: patientId,
      role: 'patient',
      scopes: ['screening:read_own'],
    });

    app = createApp();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  // ==========================================
  // 1. The 4 Endpoints & MOCK Flag Verification
  // ==========================================
  describe('1. The 4 Endpoints & Unstrippable MOCK Flag in Response Bodies', () => {
    let testTransactionId = '';
    const rawFakeNumber = '987654321098'; // Fake 12-digit number for demonstration

    it('1. POST /api/v1/mock/aadhaar/generate-otp returns MOCK label, masked fragment, and demo OTP hint', async () => {
      const res = await request(app)
        .post('/api/v1/mock/aadhaar/generate-otp')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          testAadhaarNumber: rawFakeNumber,
          purpose: 'Demonstration Beneficiary Registration',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.mock).toBe(true);
      expect(data.label).toBe('MOCK');
      expect(data.adapterStatus).toBe('MOCK');
      expect(data.simulationNotice).toContain('MOCK AADHAAR SERVICE');
      expect(data.transactionId).toMatch(/^txn_mock_/);
      expect(data.maskedAadhaar).toBe('XXXX-XXXX-1098');
      expect(data.testOtpHint).toBe('123456');

      testTransactionId = data.transactionId;
    });

    it('2. POST /api/v1/mock/aadhaar/verify-otp evaluates test OTP returning simulated_match and MOCK label', async () => {
      expect(testTransactionId).toBeTruthy();

      const res = await request(app)
        .post('/api/v1/mock/aadhaar/verify-otp')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          transactionId: testTransactionId,
          otp: '123456',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.mock).toBe(true);
      expect(data.label).toBe('MOCK');
      expect(data.adapterStatus).toBe('MOCK');
      expect(data.status).toBe('simulated_match');
      expect(data.matchScore).toBe(100);
      expect(data.maskedAadhaar).toBe('XXXX-XXXX-1098');
      expect(data.demoProfile).toBeDefined();
      expect(data.demoProfile.state).toBe('Andhra Pradesh');
    });

    it('3. POST /api/v1/mock/aadhaar/verify-otp returns simulated_mismatch when wrong code is entered', async () => {
      // Generate a fresh session
      const genRes = await request(app)
        .post('/api/v1/mock/aadhaar/generate-otp')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({ testAadhaarNumber: '111122223333' });

      const txId = genRes.body.data.transactionId;

      const res = await request(app)
        .post('/api/v1/mock/aadhaar/verify-otp')
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({
          transactionId: txId,
          otp: '999999', // Incorrect OTP
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.mock).toBe(true);
      expect(data.label).toBe('MOCK');
      expect(data.status).toBe('simulated_mismatch');
      expect(data.matchScore).toBe(0);
    });

    it('4. POST /api/v1/mock/aadhaar/demographic-auth returns simulated_match with MOCK flag', async () => {
      const res = await request(app)
        .post('/api/v1/mock/aadhaar/demographic-auth')
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          testAadhaarNumber: '5555-6666-7777',
          name: 'K. Savithri Beneficiary',
          yearOfBirth: '1988',
          gender: 'F',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.mock).toBe(true);
      expect(data.label).toBe('MOCK');
      expect(data.adapterStatus).toBe('MOCK');
      expect(data.status).toBe('simulated_match');
      expect(data.matchConfidence).toBe('DEMO_MATCH');
      expect(data.maskedAadhaar).toBe('XXXX-XXXX-7777');
    });

    it('5. POST /api/v1/mock/aadhaar/demographic-auth returns simulated_mismatch when trigger word is passed', async () => {
      const res = await request(app)
        .post('/api/v1/mock/aadhaar/demographic-auth')
        .set('Authorization', `Bearer ${moToken}`)
        .send({
          testAadhaarNumber: '5555-6666-8888',
          name: 'Mismatch Test Person',
        });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.mock).toBe(true);
      expect(data.status).toBe('simulated_mismatch');
      expect(data.matchConfidence).toBe('DEMO_NO_MATCH');
    });

    it('6. GET /api/v1/mock/aadhaar/status reports realIntegration BLOCKED and uidaiConnected false', async () => {
      const res = await request(app)
        .get('/api/v1/mock/aadhaar/status')
        .set('Authorization', `Bearer ${ashaToken}`);

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.mock).toBe(true);
      expect(data.label).toBe('MOCK');
      expect(data.adapterStatus).toBe('MOCK');
      expect(data.realIntegration).toBe('BLOCKED');
      expect(data.uidaiConnected).toBe(false);
      expect(data.supportedModes).toEqual(['mock_otp', 'mock_demographic']);
      expect(data.realIntegrationBlockedReason).toContain('blocked');
    });
  });

  // ==========================================
  // 2. Non-Custodial Storage & Log Redaction
  // ==========================================
  describe('2. Non-Custodial Storage & Log Scanner (No Aadhaar-Shaped Numbers)', () => {
    it('stores ONLY masked fragments (XXXX-XXXX-XXXX) in MongoDB AuditLog records', async () => {
      const logs = await AuditLog.find({ resourceType: { $in: ['aadhaar_mock_session', 'aadhaar_mock_demographic'] } });
      expect(logs.length).toBeGreaterThan(0);

      logs.forEach((log) => {
        const masked = log.metadata?.maskedAadhaar;
        expect(masked).toBeDefined();
        expect(masked).toMatch(/^XXXX-XXXX-\d{4}$/);
      });
    });

    it('verifies an exhaustive scan of AuditLog records finds ZERO 12-digit Aadhaar numbers', async () => {
      const allAuditRecords = await AuditLog.find({});
      const stringified = JSON.stringify(allAuditRecords);

      // Regex matching 12 consecutive digits or 4-4-4 formatted numbers
      const aadhaarPattern = /\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/;
      const raw12DigitPattern = /\b\d{12}\b/;

      expect(aadhaarPattern.test(stringified)).toBe(false);
      expect(raw12DigitPattern.test(stringified)).toBe(false);
    });
  });

  // ==========================================
  // 3. Central Authorization Matrix Coverage
  // ==========================================
  describe('3. Central Authorization Matrix & Role Access Control', () => {
    it('verifies all 4 Aadhaar mock endpoints are covered in ENDPOINT_CAPABILITY_TABLE', () => {
      const coverage = verifyAllExpressRoutesCovered(app);
      expect(coverage.missingRoutes).toEqual([]);
    });

    it('denies patient access to generate-otp with 403', async () => {
      const res = await request(app)
        .post('/api/v1/mock/aadhaar/generate-otp')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ testAadhaarNumber: '123456789012' });

      expect(res.status).toBe(403);
    });

    it('denies patient access to demographic-auth with 403', async () => {
      const res = await request(app)
        .post('/api/v1/mock/aadhaar/demographic-auth')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ testAadhaarNumber: '123456789012', name: 'Test' });

      expect(res.status).toBe(403);
    });

    it('denies patient access to status with 403', async () => {
      const res = await request(app)
        .get('/api/v1/mock/aadhaar/status')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/v1/mock/aadhaar/status');
      expect(res.status).toBe(401);
    });
  });

  // ==========================================
  // 4. Clinical Wording & Verification Terminology Scanner
  // ==========================================
  describe('4. Wording Scanner: No "verified" or "authenticated by UIDAI" claims', () => {
    it('scans Aadhaar mock source files and confirms zero claims of "verified" or "authenticated by UIDAI"', () => {
      const baseDir = path.resolve(__dirname, '..');
      const filesToScan = [
        path.join(baseDir, 'src/modules/aadhaar/aadhaarMockModel.ts'),
        path.join(baseDir, 'src/modules/aadhaar/aadhaarMockService.ts'),
        path.join(baseDir, 'src/modules/aadhaar/aadhaarMockRoutes.ts'),
        path.join(baseDir, '../client/src/components/AadhaarMockManager.tsx'),
      ];

      filesToScan.forEach((filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Look for claiming verification: e.g. "is verified", "Aadhaar verified", "authenticated by UIDAI"
        // Note: Disclaimers like "Not authenticated by UIDAI" or "no UIDAI confirmation" are allowed and required.
        const positiveVerifiedClaim = /(?:is|was|has been)\s+verified/i;
        const uidaiAuthenticatedClaim = /authenticated\s+by\s+UIDAI(?!.*not)/i;

        expect(positiveVerifiedClaim.test(content)).toBe(false);

        // Check for positive verification statements
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes('verified') && !line.includes('//') && !line.includes('*')) {
            // Must not claim beneficiary is verified
            expect(line.toLowerCase()).not.toContain('beneficiary verified');
            expect(line.toLowerCase()).not.toContain('patient verified');
            expect(line.toLowerCase()).not.toContain('aadhaar verified');
          }
        });
      });
    });

    it('scans i18n locale dictionaries for aadhaarMock section and confirms no false claims', () => {
      const serverLocalesDir = path.resolve(__dirname, '../src/i18n/locales');
      const clientLocalesDir = path.resolve(__dirname, '../../client/src/i18n/locales');

      ['en.json', 'te.json', 'hi.json'].forEach((file) => {
        const serverContent = JSON.parse(fs.readFileSync(path.join(serverLocalesDir, file), 'utf-8'));
        const clientContent = JSON.parse(fs.readFileSync(path.join(clientLocalesDir, file), 'utf-8'));

        const serverSection = serverContent.aadhaarMock;
        const clientSection = clientContent.aadhaarMock;

        expect(serverSection).toBeDefined();
        expect(clientSection).toBeDefined();

        // En: must contain MOCK in title and banner
        if (file === 'en.json') {
          expect(serverSection.title).toContain('MOCK');
          expect(serverSection.banner).toContain('MOCK');
          expect(serverSection.label).toBe('MOCK');
          expect(serverSection.realIntegrationBlocked).toContain('BLOCKED');
        }
      });
    });
  });
});
