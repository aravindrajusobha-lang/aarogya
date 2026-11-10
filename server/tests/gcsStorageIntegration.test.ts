import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import {
  isGcsConfigured,
  normalizeCategory,
  uploadToGcs,
  generateGcsSignedUrl,
  deleteFromGcs,
} from '../src/modules/storage/gcsService.js';
import {
  savePrivateFile,
  getAuthorizedFile,
  getAuthorizedSignedUrl,
  deleteAuthorizedFile,
} from '../src/modules/storage/storageService.js';
import { StoredFile } from '../src/modules/storage/storageModel.js';
import { AuthenticatedUser } from '../src/middleware/authGuard.js';

// Mock @google-cloud/storage
const mockSave = vi.fn().mockResolvedValue(undefined);
const mockGetSignedUrl = vi.fn().mockResolvedValue(['https://storage.googleapis.com/test-bucket/signed-url-token']);
const mockDownload = vi.fn().mockResolvedValue([Buffer.from('simulated-gcs-image-content')]);
const mockDelete = vi.fn().mockResolvedValue(undefined);

const mockFile = vi.fn().mockImplementation((path: string) => ({
  save: mockSave,
  getSignedUrl: mockGetSignedUrl,
  download: mockDownload,
  delete: mockDelete,
  name: path,
}));

const mockBucket = vi.fn().mockImplementation((name: string) => ({
  file: mockFile,
  name,
}));

vi.mock('@google-cloud/storage', () => {
  return {
    Storage: vi.fn().mockImplementation(() => ({
      bucket: mockBucket,
    })),
  };
});

describe('Google Cloud Storage Integration & Security Invariants', () => {
  const originalEnv = process.env;

  const mockAdminUser: AuthenticatedUser = {
    id: 'usr_admin_001',
    role: 'admin',
    scopes: ['storage:read_clinical', 'storage:upload', 'clinical:assess'],
  };

  const mockAshaUser: AuthenticatedUser = {
    id: 'usr_asha_001',
    role: 'asha',
    scopes: ['storage:read_clinical', 'storage:upload'],
    hospitalId: 'hosp_paderu_001',
  } as any;

  const mockOtherHospitalDoctor: AuthenticatedUser = {
    id: 'usr_doc_chintapalli_001',
    role: 'medical_officer',
    scopes: ['storage:read_clinical'],
    hospitalId: 'hosp_chintapalli_002',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      GCP_PROJECT_ID: 'aarogya-drishti-paderu',
      GCS_BUCKET_NAME: 'aarogya-drishti-telehealth-storage',
    };
  });

  it('1. Correctly detects GCS configuration from environment variables', () => {
    expect(isGcsConfigured()).toBe(true);

    process.env.GCS_BUCKET_NAME = '';
    expect(isGcsConfigured()).toBe(false);
  });

  it('2. Normalizes storage categories and enforces permitted prefixes', () => {
    expect(normalizeCategory('patients/oral-images/')).toBe('patients/oral-images/');
    expect(normalizeCategory('patients/screening-reports/')).toBe('patients/screening-reports/');
    expect(normalizeCategory('hospitals/documents/')).toBe('hospitals/documents/');
    expect(normalizeCategory('doctors/documents/')).toBe('doctors/documents/');
    // Fallback to default oral images
    expect(normalizeCategory('unauthorized/custom/')).toBe('patients/oral-images/');
    expect(normalizeCategory(undefined)).toBe('patients/oral-images/');
  });

  it('3. Generates randomized, non-identifying paths with zero PII in object path (Invariant 5)', async () => {
    const testBuffer = Buffer.from('sample-oral-mucosa-scan-bytes-demo');
    const result = await uploadToGcs({
      buffer: testBuffer,
      category: 'patients/oral-images/',
      originalFilename: 'Patient_Ramesh_9440122334.jpg', // Real-world filename to test scrubbing
      mimeType: 'image/jpeg',
    });

    expect(result.bucket).toBe('aarogya-drishti-telehealth-storage');
    expect(result.objectPath.startsWith('patients/oral-images/')).toBe(true);
    // Invariant 5: PII like names or phone numbers must NEVER appear in GCS object paths
    expect(result.objectPath.includes('Ramesh')).toBe(false);
    expect(result.objectPath.includes('9440122334')).toBe(false);
    expect(result.sizeBytes).toBe(testBuffer.length);
    expect(result.sha256Hash).toBe(crypto.createHash('sha256').update(testBuffer).digest('hex'));

    expect(mockSave).toHaveBeenCalled();
  });

  it('4. Generates short-lived V4 signed URLs for authorized retrieval', async () => {
    const objectPath = 'patients/oral-images/abc-uuid-123.jpg';
    const signedUrl = await generateGcsSignedUrl(objectPath, 15);

    expect(signedUrl).toBe('https://storage.googleapis.com/test-bucket/signed-url-token');
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 'v4',
        action: 'read',
      })
    );
  });

  it('5. Enforces Cross-Hospital Denial (Invariant 7) when reading clinical files', async () => {
    const mockFileRecord = {
      fileId: '00000000-0000-4000-8000-000000000001',
      originalFilename: 'oral_lesion.jpg',
      mimeType: 'image/jpeg',
      accessScopes: ['storage:read_clinical'],
      storageProvider: 'gcs',
      gcsObjectPath: 'patients/oral-images/sample-123.jpg',
      hospitalId: 'hosp_paderu_001',
      uploadStatus: 'completed',
    };

    vi.spyOn(StoredFile, 'findOne').mockResolvedValue(mockFileRecord as any);

    // Same hospital user or admin can access signed URL
    const adminUrlResult = await getAuthorizedSignedUrl(mockFileRecord.fileId, mockAdminUser);
    expect(adminUrlResult.signedUrl).toBeDefined();

    // Cross-hospital doctor attempting to access file from another hospital is denied
    await expect(
      getAuthorizedSignedUrl(mockFileRecord.fileId, mockOtherHospitalDoctor)
    ).rejects.toThrow(/Cross-hospital access denied/i);
  });

  it('6. Rejects unauthorized file deletion from frontline ASHA workers and permits medical officers/admins', async () => {
    const mockFileRecord = {
      fileId: '00000000-0000-4000-8000-000000000002',
      originalFilename: 'oral_lesion.jpg',
      storageProvider: 'gcs',
      gcsObjectPath: 'patients/oral-images/sample-delete.jpg',
      accessScopes: ['storage:read_clinical'],
      uploadStatus: 'completed',
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(StoredFile, 'findOne').mockResolvedValue(mockFileRecord as any);

    // ASHA frontline workers cannot delete clinical records
    await expect(
      deleteAuthorizedFile(mockFileRecord.fileId, mockAshaUser)
    ).rejects.toThrow(/Only medical officers or administrators are permitted/i);

    // Admin can delete clinical records
    const deleteResult = await deleteAuthorizedFile(mockFileRecord.fileId, mockAdminUser);
    expect(deleteResult.success).toBe(true);
    expect(mockFileRecord.uploadStatus).toBe('deleted');
    expect(mockDelete).toHaveBeenCalled();
  });
});

