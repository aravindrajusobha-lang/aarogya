import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { StoredFile, IStoredFile, StorageCategory } from './storageModel.js';
import { AuthenticatedUser } from '../../middleware/authGuard.js';
import {
  isGcsConfigured,
  uploadToGcs,
  generateGcsSignedUrl,
  downloadFromGcs,
  deleteFromGcs,
  normalizeCategory,
} from './gcsService.js';
import { logger } from '../../config/logger.js';

const STORAGE_ROOT = path.resolve(process.cwd(), 'storage', 'private_uploads');

export async function ensureStorageDirectory(): Promise<string> {
  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  return STORAGE_ROOT;
}

export interface SaveFileInput {
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
  uploader: AuthenticatedUser;
  accessScopes?: string[];
  category?: StorageCategory | string;
  patientId?: string;
  screeningReferenceId?: string;
  hospitalId?: string;
}

export async function savePrivateFile(input: SaveFileInput): Promise<IStoredFile> {
  const fileId = uuidv4();
  const sha256Hash = crypto.createHash('sha256').update(input.buffer).digest('hex');
  const category = normalizeCategory(input.category);

  // Check if Google Cloud Storage is active
  if (isGcsConfigured()) {
    try {
      const gcsResult = await uploadToGcs({
        buffer: input.buffer,
        category,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        customMetadata: {
          fileId,
          uploaderId: input.uploader.id,
          uploaderRole: input.uploader.role,
          patientId: input.patientId || '',
          screeningReferenceId: input.screeningReferenceId || '',
        },
      });

      const record = await StoredFile.create({
        fileId,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        sha256Hash,
        storedPath: `gs://${gcsResult.bucket}/${gcsResult.objectPath}`,
        uploadedBy: input.uploader.id,
        uploaderRole: input.uploader.role,
        accessScopes: input.accessScopes || ['storage:read_clinical'],
        simulation: true,

        // GCS Metadata
        storageProvider: 'gcs',
        gcsBucket: gcsResult.bucket,
        gcsObjectPath: gcsResult.objectPath,
        category,
        patientId: input.patientId || null,
        screeningReferenceId: input.screeningReferenceId || null,
        uploadStatus: 'completed',
        hospitalId: input.hospitalId || (input.uploader as any).hospitalId || null,
      });

      return record;
    } catch (gcsErr: any) {
      logger.warn(
        { err: gcsErr.message },
        'GCS upload encountered error; falling back to secure local private storage'
      );
    }
  }

  // Local storage fallback (offline / local dev mode)
  await ensureStorageDirectory();
  const safeFilename = `${fileId}.dat`;
  const destinationPath = path.join(STORAGE_ROOT, safeFilename);

  await fs.writeFile(destinationPath, input.buffer, { mode: 0o600 });

  const record = await StoredFile.create({
    fileId,
    originalFilename: input.originalFilename,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
    sha256Hash,
    storedPath: destinationPath,
    uploadedBy: input.uploader.id,
    uploaderRole: input.uploader.role,
    accessScopes: input.accessScopes || ['storage:read_clinical'],
    simulation: true,

    storageProvider: 'local',
    category,
    patientId: input.patientId || null,
    screeningReferenceId: input.screeningReferenceId || null,
    uploadStatus: 'completed',
    hospitalId: input.hospitalId || (input.uploader as any).hospitalId || null,
  });

  return record;
}

/**
 * Checks authorization and Cross-Hospital access bounds (Invariant 7)
 */
function verifyFileAccess(record: IStoredFile, user: AuthenticatedUser): void {
  // 1. Role / Scope Check
  const hasScope = record.accessScopes.some((scope: string) => user.scopes.includes(scope));
  if (!hasScope && user.role !== 'admin') {
    const error = new Error('Insufficient permissions to access this clinical file');
    (error as any).statusCode = 403;
    (error as any).code = 'FORBIDDEN_FILE_ACCESS';
    throw error;
  }

  // 2. Cross-Hospital Denial (Invariant 7)
  const userHospitalId = (user as any).hospitalId;
  if (
    user.role !== 'admin' &&
    record.hospitalId &&
    userHospitalId &&
    record.hospitalId !== userHospitalId
  ) {
    const error = new Error('Cross-hospital access denied: file belongs to another hospital facility');
    (error as any).statusCode = 403;
    (error as any).code = 'CROSS_HOSPITAL_DENIAL';
    throw error;
  }
}

export async function getAuthorizedFile(
  fileId: string,
  user: AuthenticatedUser
): Promise<{ fileRecord: IStoredFile; stream: NodeJS.ReadableStream }> {
  const record = await StoredFile.findOne({ fileId, uploadStatus: { $ne: 'deleted' } });
  if (!record) {
    const error = new Error('File not found');
    (error as any).statusCode = 404;
    (error as any).code = 'FILE_NOT_FOUND';
    throw error;
  }

  verifyFileAccess(record, user);

  // If stored in GCS, stream from Google Cloud Storage
  if (record.storageProvider === 'gcs' && record.gcsObjectPath) {
    const buffer = await downloadFromGcs(record.gcsObjectPath);
    const stream = Readable.from(buffer);
    return { fileRecord: record, stream };
  }

  // Stored locally
  if (!existsSync(record.storedPath)) {
    const error = new Error('Physical file missing from private storage');
    (error as any).statusCode = 404;
    (error as any).code = 'FILE_DATA_MISSING';
    throw error;
  }

  const stream = createReadStream(record.storedPath);
  return { fileRecord: record, stream };
}

/**
 * Generates a short-lived signed URL or proxy URL for authorized viewers
 */
export async function getAuthorizedSignedUrl(
  fileId: string,
  user: AuthenticatedUser,
  expiresInMinutes = 15
): Promise<{ signedUrl: string; expiresAt: Date; fileRecord: IStoredFile }> {
  const record = await StoredFile.findOne({ fileId, uploadStatus: { $ne: 'deleted' } });
  if (!record) {
    const error = new Error('File not found');
    (error as any).statusCode = 404;
    (error as any).code = 'FILE_NOT_FOUND';
    throw error;
  }

  verifyFileAccess(record, user);

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  if (record.storageProvider === 'gcs' && record.gcsObjectPath && isGcsConfigured()) {
    const signedUrl = await generateGcsSignedUrl(record.gcsObjectPath, expiresInMinutes);
    return { signedUrl, expiresAt, fileRecord: record };
  }

  // Authenticated proxy endpoint fallback
  const proxyUrl = `/api/v1/storage/files/${record.fileId}`;
  return { signedUrl: proxyUrl, expiresAt, fileRecord: record };
}

/**
 * Authorized deletion where legally permitted (medical officer / admin)
 */
export async function deleteAuthorizedFile(
  fileId: string,
  user: AuthenticatedUser
): Promise<{ success: boolean; message: string }> {
  const allowedRoles = ['admin', 'specialist', 'medical_officer'];
  if (!allowedRoles.includes(user.role)) {
    const error = new Error('Only medical officers or administrators are permitted to delete clinical records');
    (error as any).statusCode = 403;
    (error as any).code = 'UNAUTHORIZED_FILE_DELETION';
    throw error;
  }

  const record = await StoredFile.findOne({ fileId });
  if (!record) {
    const error = new Error('File not found');
    (error as any).statusCode = 404;
    (error as any).code = 'FILE_NOT_FOUND';
    throw error;
  }

  verifyFileAccess(record, user);

  if (record.storageProvider === 'gcs' && record.gcsObjectPath) {
    await deleteFromGcs(record.gcsObjectPath);
  } else if (existsSync(record.storedPath)) {
    try {
      await fs.unlink(record.storedPath);
    } catch {
      // Ignore local unlink errors
    }
  }

  record.uploadStatus = 'deleted';
  await record.save();

  return { success: true, message: 'File deleted successfully' };
}
