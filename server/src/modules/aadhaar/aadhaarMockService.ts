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
import { isGeminiConfigured } from '../assistant/geminiService.js';

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

  /**
   * 5. OCR Extraction for Assisted Registration (Workflow 1)
   * Extracts name, age/dob, gender, village, and masked Aadhaar.
   * Never logs, returns, or stores raw 12-digit Aadhaar.
   * Adheres strictly to Invariant 5 (Zero raw Aadhaar storage).
   */
  static async extractOcrData(
    frontImageBase64: string,
    backImageBase64?: string,
    consentObtained: boolean = true,
    actor?: AadhaarActorContext
  ) {
    if (!consentObtained) {
      throw new Error('Informed consent required before extracting identification data');
    }

    const mimeMatch = (frontImageBase64 || '').match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const cleanFront = (frontImageBase64 || '').replace(/^data:[^;]+;base64,/, '');

    let extracted = {
      fullName: 'Korra Somulu',
      gender: 'male' as 'male' | 'female' | 'other',
      dob: '15/07/1972',
      ageEstimated: 54,
      guardianName: 'Korra Somanna',
      villageName: 'Vankachinta',
      villageId: 'VILLAGE_PADERU_01',
      mandal: 'Paderu',
      district: 'Alluri Sitharama Raju',
      originalAddressText: 'Near Old Water Tank, Vankachinta, Paderu Mandal, ASR District',
      maskedAadhaar: 'XXXX-XXXX-8921',
    };

    if (isGeminiConfigured() && cleanFront.length > 100) {
      try {
        const apiKey = process.env.GEMINI_API_KEY?.trim();
        const configuredModel = process.env.GEMINI_MODEL?.trim();
        const model = configuredModel && configuredModel !== 'gemini-3.5-flash' ? configuredModel : 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const systemPrompt = `You are a privacy-safe OCR extraction assistant for the Aarogya-Drishti healthcare platform in Andhra Pradesh.
Extract permitted patient registration fields from the sample identity card:
1. Full Name
2. Date of birth (or year of birth) and approximate age
3. Gender (male, female, or other)
4. Guardian / father / husband name if visible
5. Village, Mandal, District if visible
6. Masked Aadhaar: ONLY the last 4 digits masked as "XXXX-XXXX-1234". CRITICAL PRIVACY RULE: NEVER return full 12 digits.

Respond ONLY with valid JSON matching:
{
  "fullName": "Name",
  "gender": "male | female | other",
  "dob": "DD/MM/YYYY",
  "ageEstimated": 45,
  "guardianName": "Father / Husband name",
  "villageName": "Village name",
  "mandal": "Mandal name",
  "district": "Alluri Sitharama Raju",
  "originalAddressText": "Full address text",
  "maskedAadhaar": "XXXX-XXXX-1234"
}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);

        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: 'Extract patient registration fields from this sample card.' },
                  { inlineData: { mimeType, data: cleanFront } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
            systemInstruction: { parts: [{ text: systemPrompt }] },
          }),
        });
        clearTimeout(timer);

        if (geminiRes.ok) {
          const geminiJson = (await geminiRes.json()) as any;
          const outText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (outText) {
            const parsed = JSON.parse(outText);
            extracted = {
              fullName: parsed.fullName || extracted.fullName,
              gender: ['male', 'female', 'other'].includes(parsed.gender) ? parsed.gender : extracted.gender,
              dob: parsed.dob || extracted.dob,
              ageEstimated: Number(parsed.ageEstimated) || extracted.ageEstimated,
              guardianName: parsed.guardianName || extracted.guardianName,
              villageName: parsed.villageName || extracted.villageName,
              villageId: 'VILLAGE_PADERU_01',
              mandal: parsed.mandal || extracted.mandal,
              district: parsed.district || extracted.district,
              originalAddressText: parsed.originalAddressText || extracted.originalAddressText,
              maskedAadhaar: maskAadhaar(parsed.maskedAadhaar || 'XXXX-XXXX-8921'),
            };
          }
        }
      } catch {
        // Fall back to clean simulated demo extraction
      }
    }

    if (actor) {
      await AuditLog.create({
        action: 'aadhaar.ocr_extracted',
        actorId: actor.userId,
        actorRole: actor.role,
        resourceType: 'aadhaar_ocr',
        resourceId: extracted.maskedAadhaar,
        ip: actor.ip || '127.0.0.1',
        statusCode: 200,
        metadata: {
          maskedAadhaar: extracted.maskedAadhaar,
          nameExtracted: extracted.fullName,
          consentObtained,
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
      extracted,
      extractedData: extracted,
      consentObtained: true,
      disclaimer: 'OCR PRE-POPULATION DEMO — ZERO RAW AADHAAR NUMBERS OR CARD IMAGES STORED.',
    };
  }
}
