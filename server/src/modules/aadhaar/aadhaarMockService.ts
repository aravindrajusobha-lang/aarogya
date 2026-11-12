import crypto from 'crypto';
import {
  MOCK_BANNER_TEXT,
  MOCK_LABEL,
  maskAadhaar,
  AadhaarOtpGenerateResponse,
  AadhaarOtpVerifyResponse,
  AadhaarDemographicAuthResponse,
  AadhaarStatusResponse,
} from './aadhaarMockModel.js';
import { AuditLog } from '../audit/auditModel.js';

interface MockOtpSession {
  transactionId: string;
  maskedAadhaar: string;
  testOtp: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
}

// In-memory session store for simulated OTP transactions with 5-minute expiry
const mockSessions = new Map<string, MockOtpSession>();

// Cleanup expired sessions every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [txId, session] of mockSessions.entries()) {
    if (session.expiresAt <= now) {
      mockSessions.delete(txId);
    }
  }
}, 60000).unref();

export interface AadhaarActorContext {
  userId: string;
  role: string;
  ip?: string;
}

export class AadhaarMockService {
  /**
   * 1. Generate simulated OTP for a test Aadhaar number
   * Full 12-digit number is immediately masked; never stored or logged.
   */
  static async generateOtp(
    rawTestNumber: string,
    purpose: string = 'Demonstration Patient Registration',
    actor?: AadhaarActorContext
  ): Promise<AadhaarOtpGenerateResponse> {
    const masked = maskAadhaar(rawTestNumber);
    const transactionId = `txn_mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = Date.now();
    const expiresInSeconds = 300; // 5 minutes

    // Fixed predictable demo OTP for test suites & offline simulation
    const testOtp = '123456';

    mockSessions.set(transactionId, {
      transactionId,
      maskedAadhaar: masked,
      testOtp,
      createdAt: now,
      expiresAt: now + expiresInSeconds * 1000,
      attempts: 0,
    });

    // Immutable audit trail: stores ONLY the masked fragment
    if (actor) {
      await AuditLog.create({
        action: 'aadhaar.mock_otp_generated',
        actorId: actor.userId,
        actorRole: actor.role,
        resourceType: 'aadhaar_mock_session',
        resourceId: transactionId,
        ip: actor.ip || '127.0.0.1',
        statusCode: 200,
        metadata: {
          transactionId,
          maskedAadhaar: masked,
          purpose,
          mock: true,
          simulation: true,
        },
        simulation: true,
      });
    }

    return {
      mock: true,
      label: MOCK_LABEL,
      adapterStatus: 'MOCK',
      simulationNotice: MOCK_BANNER_TEXT,
      transactionId,
      maskedAadhaar: masked,
      expiresInSeconds,
      testOtpHint: testOtp,
      message: 'Simulated OTP dispatched to test recipient. Demonstration mode active.',
    };
  }

  /**
   * 2. Evaluate simulated OTP
   * Evaluates OTP match without claiming UIDAI verification.
   */
  static async verifyOtp(
    transactionId: string,
    otp: string,
    actor?: AadhaarActorContext
  ): Promise<AadhaarOtpVerifyResponse> {
    const session = mockSessions.get(transactionId);
    const now = Date.now();

    if (!session || session.expiresAt <= now) {
      return {
        mock: true,
        label: MOCK_LABEL,
        adapterStatus: 'MOCK',
        simulationNotice: MOCK_BANNER_TEXT,
        transactionId,
        maskedAadhaar: session ? session.maskedAadhaar : 'XXXX-XXXX-0000',
        status: 'simulated_expired',
        matchScore: 0,
        message: 'Simulated OTP session has expired or does not exist.',
      };
    }

    session.attempts += 1;
    const isMatch = otp.trim() === session.testOtp;

    if (actor) {
      await AuditLog.create({
        action: 'aadhaar.mock_otp_evaluated',
        actorId: actor.userId,
        actorRole: actor.role,
        resourceType: 'aadhaar_mock_session',
        resourceId: transactionId,
        ip: actor.ip || '127.0.0.1',
        statusCode: 200,
        metadata: {
          transactionId,
          maskedAadhaar: session.maskedAadhaar,
          matchResult: isMatch ? 'simulated_match' : 'simulated_mismatch',
          attempts: session.attempts,
          mock: true,
          simulation: true,
        },
        simulation: true,
      });
    }

    if (!isMatch) {
      return {
        mock: true,
        label: MOCK_LABEL,
        adapterStatus: 'MOCK',
        simulationNotice: MOCK_BANNER_TEXT,
        transactionId,
        maskedAadhaar: session.maskedAadhaar,
        status: 'simulated_mismatch',
        matchScore: 0,
        message: 'Simulated OTP mismatch. Use test code 123456 in demonstration mode.',
      };
    }

    // Clean up consumed session
    mockSessions.delete(transactionId);

    return {
      mock: true,
      label: MOCK_LABEL,
      adapterStatus: 'MOCK',
      simulationNotice: MOCK_BANNER_TEXT,
      transactionId,
      maskedAadhaar: session.maskedAadhaar,
      status: 'simulated_match',
      matchScore: 100,
      demoProfile: {
        name: 'Simulated Tribal Beneficiary',
        gender: 'F',
        yearOfBirth: '1988',
        state: 'Andhra Pradesh',
        district: 'Alluri Sitharama Raju (Paderu)',
      },
      message: 'Simulated OTP match completed in demo environment. Not authenticated by UIDAI.',
    };
  }

  /**
   * 3. Simulated Demographic Match
   * Compares test name and birth year against mock fixture.
   */
  static async demographicAuth(
    rawTestNumber: string,
    name: string,
    yearOfBirth?: string,
    gender?: string,
    actor?: AadhaarActorContext
  ): Promise<AadhaarDemographicAuthResponse> {
    const masked = maskAadhaar(rawTestNumber);
    const trimmedName = (name || '').trim();

    // Simulated rejection trigger for testing: names with "mismatch" or "fail"
    const isMismatch =
      !trimmedName ||
      trimmedName.toLowerCase().includes('mismatch') ||
      trimmedName.toLowerCase().includes('fail');

    const status = isMismatch ? 'simulated_mismatch' : 'simulated_match';
    const matchConfidence = isMismatch ? 'DEMO_NO_MATCH' : 'DEMO_MATCH';

    if (actor) {
      await AuditLog.create({
        action: 'aadhaar.mock_demographic_evaluated',
        actorId: actor.userId,
        actorRole: actor.role,
        resourceType: 'aadhaar_mock_demographic',
        resourceId: masked,
        ip: actor.ip || '127.0.0.1',
        statusCode: 200,
        metadata: {
          maskedAadhaar: masked,
          status,
          matchConfidence,
          mock: true,
          simulation: true,
        },
        simulation: true,
      });
    }

    return {
      mock: true,
      label: MOCK_LABEL,
      adapterStatus: 'MOCK',
      simulationNotice: MOCK_BANNER_TEXT,
      maskedAadhaar: masked,
      status,
      matchConfidence,
      message: isMismatch
        ? 'Simulated demographic evaluation resulted in mismatch.'
        : 'Simulated demographic evaluation matched test parameters. Demonstration simulation only; no UIDAI confirmation.',
    };
  }

  /**
   * 4. Adapter Status
   * Reports mock adapter operational parameters and confirms real UIDAI integration is BLOCKED.
   */
  static getStatus(): AadhaarStatusResponse {
    return {
      mock: true,
      label: MOCK_LABEL,
      adapterStatus: 'MOCK',
      simulationNotice: MOCK_BANNER_TEXT,
      realIntegration: 'BLOCKED',
      realIntegrationBlockedReason:
        'Direct UIDAI integration is blocked in this demonstration environment to safeguard tribal patient privacy and adhere to hackathon simulation constraints.',
      uidaiConnected: false,
      supportedModes: ['mock_otp', 'mock_demographic'],
      operationalNotice:
        'All Aadhaar operations execute via in-memory mock adapters using masked test identifiers only.',
    };
  }

}
