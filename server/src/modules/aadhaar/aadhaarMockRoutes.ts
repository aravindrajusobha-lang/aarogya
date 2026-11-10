import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validate } from '../../middleware/validate.js';
import { AadhaarMockService } from './aadhaarMockService.js';

const router = Router();

const GenerateOtpSchema = z.object({
  testAadhaarNumber: z.string().min(4, 'Test Aadhaar number must contain at least 4 digits'),
  purpose: z.string().optional(),
});

const VerifyOtpSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required'),
  otp: z.string().min(4, 'OTP must be at least 4 characters'),
});

const DemographicAuthSchema = z.object({
  testAadhaarNumber: z.string().min(4, 'Test Aadhaar number must contain at least 4 digits'),
  name: z.string().min(1, 'Name is required for simulated demographic match'),
  yearOfBirth: z.string().optional(),
  gender: z.string().optional(),
});

function getActor(req: Request) {
  return {
    userId: req.user?.id || 'anonymous_demo',
    role: req.user?.role || 'unassigned',
    ip: req.ip || '127.0.0.1',
  };
}

// 1. POST /api/v1/mock/aadhaar/generate-otp
router.post(
  '/generate-otp',
  requireAuth,
  authorizeCapability('aadhaar:mock_auth'),
  auditTag('aadhaar.mock_otp_generate', 'aadhaar_mock'),
  validate(GenerateOtpSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testAadhaarNumber, purpose } = req.body;
      const result = await AadhaarMockService.generateOtp(
        testAadhaarNumber,
        purpose,
        getActor(req)
      );
      res.envelope(result);
    } catch (err) {
      next(err);
    }
  }
);

// 2. POST /api/v1/mock/aadhaar/verify-otp
router.post(
  '/verify-otp',
  requireAuth,
  authorizeCapability('aadhaar:mock_auth'),
  auditTag('aadhaar.mock_otp_verify', 'aadhaar_mock'),
  validate(VerifyOtpSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { transactionId, otp } = req.body;
      const result = await AadhaarMockService.verifyOtp(
        transactionId,
        otp,
        getActor(req)
      );
      res.envelope(result);
    } catch (err) {
      next(err);
    }
  }
);

// 3. POST /api/v1/mock/aadhaar/demographic-auth
router.post(
  '/demographic-auth',
  requireAuth,
  authorizeCapability('aadhaar:mock_auth'),
  auditTag('aadhaar.mock_demographic_auth', 'aadhaar_mock'),
  validate(DemographicAuthSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { testAadhaarNumber, name, yearOfBirth, gender } = req.body;
      const result = await AadhaarMockService.demographicAuth(
        testAadhaarNumber,
        name,
        yearOfBirth,
        gender,
        getActor(req)
      );
      res.envelope(result);
    } catch (err) {
      next(err);
    }
  }
);

// 4. GET /api/v1/mock/aadhaar/status
router.get(
  '/status',
  requireAuth,
  authorizeCapability('aadhaar:mock_read'),
  auditTag('aadhaar.mock_status', 'aadhaar_mock'),
  (_req: Request, res: Response): void => {
    const status = AadhaarMockService.getStatus();
    res.envelope(status);
  }
);

const OcrExtractSchema = z.object({
  frontImage: z.string().min(1, 'Aadhaar front card image is required'),
  backImage: z.string().optional(),
  consentObtained: z.boolean().refine((val) => val === true, {
    message: 'Patient informed consent is mandatory for Aadhaar OCR extraction',
  }),
});

// 5. POST /api/v1/mock/aadhaar/ocr-extract (Workflow 1)
router.post(
  '/ocr-extract',
  requireAuth,
  authorizeCapability('patient:create'),
  auditTag('aadhaar.ocr_extract', 'aadhaar_mock'),
  validate(OcrExtractSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { frontImage, backImage, consentObtained } = req.body;
      const result = await AadhaarMockService.extractOcrData(
        frontImage,
        backImage,
        consentObtained,
        getActor(req)
      );
      res.envelope(result, 'Aadhaar OCR extraction completed (masked privacy demo)');
    } catch (err) {
      next(err);
    }
  }
);

export default router;
export { router as aadhaarMockRouter };
