import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { StoredFile, IStoredFile } from './storageModel.js';
import { AuthenticatedUser } from '../../middleware/authGuard.js';

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
}

export async function savePrivateFile(input: SaveFileInput): Promise<IStoredFile> {
  await ensureStorageDirectory();

  const fileId = uuidv4();
  const sha256Hash = crypto.createHash('sha256').update(input.buffer).digest('hex');
  const safeFilename = `${fileId}.dat`;
  const destinationPath = path.join(STORAGE_ROOT, safeFilename);

  // Write file to private disk with restricted permissions
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
  });

  return record;
}

export async function getAuthorizedFile(
  fileId: string,
  user: AuthenticatedUser
): Promise<{ fileRecord: IStoredFile; stream: NodeJS.ReadableStream }> {
  const record = await StoredFile.findOne({ fileId });
  if (!record) {
    const error = new Error('File not found');
    (error as Error & { statusCode: number; code: string }).statusCode = 404;
    (error as Error & { statusCode: number; code: string }).code = 'FILE_NOT_FOUND';
    throw error;
  }

  // Enforce Scope / Authorization Check
  const hasScope = record.accessScopes.some((scope: string) => user.scopes.includes(scope));
  if (!hasScope && user.role !== 'admin') {
    const error = new Error('Insufficient permissions to access this clinical file');
    (error as Error & { statusCode: number; code: string }).statusCode = 403;
    (error as Error & { statusCode: number; code: string }).code = 'FORBIDDEN_FILE_ACCESS';
    throw error;
  }

  if (!existsSync(record.storedPath)) {
    const error = new Error('Physical file missing from private storage');
    (error as Error & { statusCode: number; code: string }).statusCode = 404;
    (error as Error & { statusCode: number; code: string }).code = 'FILE_DATA_MISSING';
    throw error;
  }

  const stream = createReadStream(record.storedPath);
  return { fileRecord: record, stream };
}
