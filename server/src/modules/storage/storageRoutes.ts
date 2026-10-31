import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth, requireScope } from '../../middleware/authGuard.js';
import { auditTag } from '../../middleware/auditTag.js';
import { savePrivateFile, getAuthorizedFile } from './storageService.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';

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

// POST /api/v1/storage/upload
router.post(
  '/upload',
  requireAuth,
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

      const saved = await savePrivateFile({
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        buffer: req.file.buffer,
        uploader: req.user,
        accessScopes: ['storage:read_clinical'],
      });

      res.status(201).envelope({
        fileId: saved.fileId,
        originalFilename: saved.originalFilename,
        mimeType: saved.mimeType,
        sizeBytes: saved.sizeBytes,
        sha256Hash: saved.sha256Hash,
        accessEndpoint: `/api/v1/storage/files/${saved.fileId}`,
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
  requireScope('storage:read_clinical'),
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

export const storageRouter = router;
