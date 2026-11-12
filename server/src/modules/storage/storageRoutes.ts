import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth, requireScope } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import {
  savePrivateFile,
  getAuthorizedFile,
  getAuthorizedSignedUrl,
  deleteAuthorizedFile,
} from './storageService.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { authorizeCapability } from '../auth/authorizationEngine.js';
import { validateMagicBytes } from './magicBytes.js';

const router = Router();

// In-memory multer upload with 10MB limit and safe MIME type filtering
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WEBP, PDF`));
    }
  },
});

const FileParamsSchema = z.object({
  fileId: z.string().uuid({ message: 'Valid UUID fileId required' }),
});

const SignedUrlQuerySchema = z.object({
  expiresInMinutes: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 15)),
});

// POST /api/v1/storage/upload
router.post(
  '/upload',
  requireAuth,
  authorizeCapability('storage:upload'),
  auditTag('STORAGE_FILE_UPLOAD', 'file'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.envelopeError('FILE_REQUIRED', 'No file uploaded under key "file"', undefined, 400);
        return;
      }

      if (!req.user) {
        res.envelopeError('UNAUTHORIZED', 'Authentication required', undefined, 401);
        return;
      }

      // Binary magic number verification to prevent MIME spoofing
      const magicCheck = validateMagicBytes(req.file.buffer, req.file.mimetype);
      if (!magicCheck.valid) {
        res.envelopeError(
          'INVALID_FILE_SIGNATURE',
          magicCheck.error || 'Binary signature does not match declared MIME type.',
          undefined,
          400
        );
        return;
      }

      const category = (req.body.category as string) || 'patients/oral-images/';
      const patientId = req.body.patientId as string | undefined;
      const screeningReferenceId = req.body.screeningReferenceId as string | undefined;
      const hospitalId = (req.body.hospitalId as string) || (req.user as any).hospitalId;

      const saved = await savePrivateFile({
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
        uploader: req.user,
        accessScopes: ['storage:read_clinical'],
        category,
        patientId,
        screeningReferenceId,
        hospitalId,
      });

      res.status(201).envelope({
        fileId: saved.fileId,
        originalFilename: saved.originalFilename,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        sha256Hash: saved.sha256Hash,
        storageProvider: saved.storageProvider,
        category: saved.category,
        patientId: saved.patientId,
        screeningReferenceId: saved.screeningReferenceId,
        accessEndpoint: `/api/v1/storage/files/${saved.fileId}`,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/storage/files/:fileId/signed-url
router.get(
  '/files/:fileId/signed-url',
  validate({ params: FileParamsSchema, query: SignedUrlQuerySchema }),
  requireAuth,
  requireScope('storage:read_clinical'),
  auditTag('STORAGE_FILE_SIGNED_URL', 'file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fileId = req.params.fileId as string;
      const expiresInMinutes = req.query.expiresInMinutes ? Number(req.query.expiresInMinutes) : 15;

      const result = await getAuthorizedSignedUrl(fileId, req.user!, expiresInMinutes);

      res.envelope({
        fileId: result.fileRecord.fileId,
        signedUrl: result.signedUrl,
        expiresAt: result.expiresAt,
        storageProvider: result.fileRecord.storageProvider,
        mimeType: result.fileRecord.mimeType,
        sizeBytes: result.fileRecord.sizeBytes,
        simulation: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/storage/files/:fileId
router.get(
  '/files/:fileId',
  validate({ params: FileParamsSchema }),
  requireAuth,
  auditTag('STORAGE_FILE_READ', 'file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fileId = req.params.fileId as string;
      const { fileRecord, stream } = await getAuthorizedFile(fileId, req.user!);

      res.setHeader('Content-Type', fileRecord.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${fileRecord.originalFilename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('X-Simulation-Data', 'true');

      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/storage/files/:fileId
router.delete(
  '/files/:fileId',
  validate({ params: FileParamsSchema }),
  requireAuth,
  auditTag('STORAGE_FILE_DELETE', 'file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const fileId = req.params.fileId as string;
      const result = await deleteAuthorizedFile(fileId, req.user!);
      res.envelope(result, 'File deleted successfully');
    } catch (err) {
      next(err);
    }
  }
);

export const storageRouter = router;
