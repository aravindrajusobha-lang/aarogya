import { Storage } from '@google-cloud/storage';
import crypto from 'node:crypto';
import path from 'node:path';
import { logger } from '../../config/logger.js';
import { StorageCategory } from './storageModel.js';

let storageClient: Storage | null = null;

/**
 * Check if Google Cloud Storage is configured via environment variables
 */
export function isGcsConfigured(): boolean {
  const bucket = process.env.GCS_BUCKET_NAME;
  const project = process.env.GCP_PROJECT_ID;
  return Boolean(bucket && bucket.trim().length > 0 && project && project.trim().length > 0);
}

/**
 * Returns the singleton GCS client initialized with ADC or explicit key
 */
export function getGcsClient(): Storage {
  if (storageClient) return storageClient;

  const projectId = process.env.GCP_PROJECT_ID;
  const keyFilename = process.env.GCS_KEY_FILE;

  if (keyFilename) {
    storageClient = new Storage({ projectId, keyFilename });
  } else {
    // Application Default Credentials (ADC)
    storageClient = new Storage({ projectId });
  }

  return storageClient;
}

/**
 * Validates and normalizes allowed storage categories
 */
export function normalizeCategory(category?: string): StorageCategory {
  const validCategories: StorageCategory[] = [
    'patients/oral-images/',
    'patients/screening-reports/',
    'patients/medical-documents/',
    'patients/consultation-records/',
    'hospitals/documents/',
    'doctors/documents/',
  ];

  if (category && validCategories.includes(category as StorageCategory)) {
    return category as StorageCategory;
  }
  return 'patients/oral-images/';
}

/**
 * Uploads a buffer to Google Cloud Storage under a randomized, non-identifying object path
 */
export async function uploadToGcs(params: {
  buffer: Buffer;
  category: StorageCategory | string;
  originalFilename: string;
  mimeType: string;
  customMetadata?: Record<string, string>;
}): Promise<{
  bucket: string;
  objectPath: string;
  sizeBytes: number;
  sha256Hash: string;
}> {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable is not configured');
  }

  const category = normalizeCategory(params.category);
  const ext = path.extname(params.originalFilename).toLowerCase() || '.dat';
  // Random, non-identifying object name (UUIDv4 + timestamp) to preserve Invariant 5
  const randomName = `${crypto.randomUUID()}_${Date.now()}${ext}`;
  const objectPath = `${category}${randomName}`;

  const sha256Hash = crypto.createHash('sha256').update(params.buffer).digest('hex');

  const storage = getGcsClient();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);

  logger.info(
    { bucket: bucketName, objectPath, mimeType: params.mimeType, size: params.buffer.length },
    'Uploading file to Google Cloud Storage'
  );

  await file.save(params.buffer, {
    contentType: params.mimeType,
    resumable: false,
    metadata: {
      contentType: params.mimeType,
      metadata: {
        sha256Hash,
        simulation: 'true',
        ...(params.customMetadata || {}),
      },
    },
  });

  return {
    bucket: bucketName,
    objectPath,
    sizeBytes: params.buffer.length,
    sha256Hash,
  };
}

/**
 * Generates a short-lived V4 signed URL for secure, scoped access
 */
export async function generateGcsSignedUrl(
  objectPath: string,
  expiresInMinutes = 15
): Promise<string> {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable is not configured');
  }

  const storage = getGcsClient();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);

  const [signedUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });

  return signedUrl;
}

/**
 * Downloads a file buffer from GCS (e.g. for AI Vision analysis or authenticated stream proxy)
 */
export async function downloadFromGcs(objectPath: string): Promise<Buffer> {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('GCS_BUCKET_NAME environment variable is not configured');
  }

  const storage = getGcsClient();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);

  const [buffer] = await file.download();
  return buffer;
}

/**
 * Deletes an object from Google Cloud Storage
 */
export async function deleteFromGcs(objectPath: string): Promise<boolean> {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) return false;

  try {
    const storage = getGcsClient();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectPath);
    await file.delete({ ignoreNotFound: true });
    logger.info({ bucket: bucketName, objectPath }, 'Object deleted from Google Cloud Storage');
    return true;
  } catch (err: any) {
    logger.error({ err: err.message, objectPath }, 'Failed to delete object from Google Cloud Storage');
    return false;
  }
}
