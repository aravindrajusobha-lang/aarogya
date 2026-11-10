/**
 * Aadhaar Mock Service Contracts & Model
 * Phase 16: Simulated demographic and OTP authentication adapter.
 * 
 * INVARIANTS:
 * 1. Every response carries `mock: true` and `label: "MOCK"`.
 * 2. Full Aadhaar numbers are never stored and never logged. Only masked fragments (XXXX-XXXX-1234) are held.
 * 3. Prohibited clinical/verifying phrasing: The system NEVER claims "verified" or "authenticated by UIDAI".
 * 4. Real Aadhaar integration is strictly BLOCKED.
 */

export const MOCK_BANNER_TEXT = '⚠️ MOCK AADHAAR SERVICE - DEMO SIMULATION ONLY - NOT CONNECTED TO UIDAI';
export const MOCK_LABEL = 'MOCK' as const;

export interface AadhaarMockBaseResponse {
  mock: true;
  label: 'MOCK';
  adapterStatus: 'MOCK';
  simulationNotice: string;
}

export interface AadhaarOtpGenerateRequest {
  testAadhaarNumber: string;
  purpose?: string;
}

export interface AadhaarOtpGenerateResponse extends AadhaarMockBaseResponse {
  transactionId: string;
  maskedAadhaar: string;
  expiresInSeconds: number;
  testOtpHint: string;
  message: string;
}

export interface AadhaarOtpVerifyRequest {
  transactionId: string;
  otp: string;
}

export interface AadhaarOtpVerifyResponse extends AadhaarMockBaseResponse {
  transactionId: string;
  maskedAadhaar: string;
  status: 'simulated_match' | 'simulated_mismatch' | 'simulated_expired';
  matchScore: number;
  demoProfile?: {
    name: string;
    gender: 'M' | 'F' | 'O';
    yearOfBirth: string;
    state: string;
    district: string;
  };
  message: string;
}

export interface AadhaarDemographicAuthRequest {
  testAadhaarNumber: string;
  name: string;
  yearOfBirth?: string;
  gender?: string;
}

export interface AadhaarDemographicAuthResponse extends AadhaarMockBaseResponse {
  maskedAadhaar: string;
  status: 'simulated_match' | 'simulated_mismatch';
  matchConfidence: 'DEMO_MATCH' | 'DEMO_PARTIAL' | 'DEMO_NO_MATCH';
  message: string;
}

export interface AadhaarStatusResponse extends AadhaarMockBaseResponse {
  realIntegration: 'BLOCKED';
  realIntegrationBlockedReason: string;
  uidaiConnected: false;
  supportedModes: string[];
  operationalNotice: string;
}

/**
 * Mask an input string or test Aadhaar number to XXXX-XXXX-1234.
 * Strips all non-digit characters and extracts ONLY the trailing 4 digits.
 */
export function maskAadhaar(rawInput: string): string {
  if (!rawInput) return 'XXXX-XXXX-0000';
  const clean = rawInput.replace(/\D/g, '');
  const last4 = clean.length >= 4 ? clean.slice(-4) : clean.padStart(4, '0');
  return `XXXX-XXXX-${last4}`;
}
