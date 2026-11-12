import { db, EncryptedQueueItem, OfflineActionType } from '../db/aarogyaDb';

const DEFAULT_LOCAL_SEED = 'AarogyaDrishti::TribalPWA::SecureOfflineKey::2026';

// Phase 17 Confirmed Limits
export const MAX_OFFLINE_QUEUE_CAPACITY = 500;
export const MAX_PHOTO_RAW_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PHOTO_COMPRESSED_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Real Encryption Strength Report
 * Required Rule: A browser cannot match Android's hardware-bound keys.
 * This report details cryptographic parameters and Known limitations.
 */
export const ENCRYPTION_STRENGTH_REPORT = {
  algorithm: 'AES-GCM-256',
  keyDerivation: 'PBKDF2-HMAC-SHA256',
  iterations: 100000,
  keyLengthBits: 256,
  nonceIvLengthBits: 96,
  tagLengthBits: 128,
  storageEngine: 'IndexedDB (Dexie.js) under WebCrypto API',
  knownLimitations: [
    'A web browser execution environment cannot match native Android hardware-backed Keystore or TEE (Trusted Execution Environment) protection.',
    'Derived keys reside in browser process memory during active sessions and are susceptible to inspection if device host OS is compromised or rooted.',
    'Browser storage quotas may purge IndexedDB data under extreme device storage pressure unless persistent storage permission (navigator.storage.persist) is granted.',
    'Cache encryption protects data at rest in IndexedDB against casual local inspection, but lacks hardware tamper-resistance.',
  ],
};

// Helper to convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Computes SHA-256 hex digest for byte-identical verification.
 */
export async function computeSha256(data: string | ArrayBuffer): Promise<string> {
  const buffer = typeof data === 'string' ? new TextEncoder().encode(data).buffer : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derives a 256-bit AES-GCM key from a passphrase/seed using PBKDF2 with 100,000 iterations.
 */
async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedResult {
  ciphertext: string;
  iv: string;
  salt: string;
  algorithm: 'AES-GCM-256';
  tagLength: 128;
}

/**
 * Encrypts an arbitrary object into AES-GCM-256 with a unique 96-bit IV and 128-bit salt.
 */
export async function encryptPayload(
  payload: Record<string, unknown>,
  passphrase = DEFAULT_LOCAL_SEED
): Promise<EncryptedResult> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit GCM nonce

  const key = await deriveAesKey(passphrase, salt);
  const enc = new TextEncoder();
  const encodedPayload = enc.encode(JSON.stringify(payload));

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer,
      tagLength: 128,
    },
    key,
    encodedPayload
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv.buffer),
    salt: bufferToBase64(salt.buffer),
    algorithm: 'AES-GCM-256',
    tagLength: 128,
  };
}

/**
 * Decrypts an AES-GCM-256 ciphertext record back into an object.
 */
export async function decryptPayload<T = Record<string, unknown>>(
  encrypted: { ciphertext: string; iv: string; salt: string },
  passphrase = DEFAULT_LOCAL_SEED
): Promise<T> {
  const saltBytes = new Uint8Array(base64ToBuffer(encrypted.salt));
  const ivBytes = new Uint8Array(base64ToBuffer(encrypted.iv));
  const ciphertextBuffer = base64ToBuffer(encrypted.ciphertext);

  const key = await deriveAesKey(passphrase, saltBytes);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes.buffer as ArrayBuffer,
      tagLength: 128,
    },
    key,
    ciphertextBuffer
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuffer)) as T;
}

/**
 * Calculates exponential backoff delay: min(1000 * 2^retryCount, 30000) ms
 */
export function calculateBackoffDelay(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), 30000);
}

/**
 * Core enqueue function validating queue capacity limit (500) and photo size limits (5 MB).
 */
export async function enqueueOfflineItem(
  type: OfflineActionType,
  payload: Record<string, unknown>,
  passphrase = DEFAULT_LOCAL_SEED
): Promise<EncryptedQueueItem> {
  // 1. Capacity Check: Max 500 actions in queue
  const currentPendingCount = await db.encryptedQueue
    .where('status')
    .anyOf(['pending', 'failed', 'conflict'])
    .count();

  if (currentPendingCount >= MAX_OFFLINE_QUEUE_CAPACITY) {
    throw new Error(
      `OFFLINE_QUEUE_CAPACITY_EXCEEDED: Maximum offline queue limit of ${MAX_OFFLINE_QUEUE_CAPACITY} actions reached. Please sync before adding new records.`
    );
  }

  // 2. Photo Size Check & Byte-Identical Integrity Hash
  let originalSha256: string | undefined = undefined;

  if (type === 'screening_photo' || payload.photoBase64 || payload.photoDataUrl) {
    const rawPhotoStr = (payload.photoBase64 || payload.photoDataUrl) as string;
    if (rawPhotoStr) {
      // Estimate raw bytes from base64 (approx 3/4 length)
      const approxSizeBytes = Math.ceil((rawPhotoStr.length * 3) / 4);
      if (approxSizeBytes > MAX_PHOTO_RAW_SIZE_BYTES) {
        throw new Error(
          `PHOTO_SIZE_EXCEEDED: Capture size (${(approxSizeBytes / 1024 / 1024).toFixed(1)} MB) exceeds 5 MB limit.`
        );
      }
      originalSha256 = await computeSha256(rawPhotoStr);
    }
  }

  // Keep the mutation key itself in UUID v4 format for the sync-ledger invariant.
  const clientMutationId = crypto.randomUUID();

  const payloadWithMeta = {
    ...payload,
    clientMutationId,
    originalSha256,
  };

  const encrypted = await encryptPayload(payloadWithMeta, passphrase);

  const queueRecord: EncryptedQueueItem = {
    clientMutationId,
    type,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    salt: encrypted.salt,
    algorithm: 'AES-GCM-256',
    tagLength: 128,
    originalSha256,
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
  };

  const id = await db.encryptedQueue.add(queueRecord);
  queueRecord.id = id;
  return queueRecord;
}

// -------------------------------------------------------------
// Specialized Helper Enqueue Functions (Phases 4, 8, 10, 11, 12, 13)
// -------------------------------------------------------------

export async function enqueueOfflinePatient(
  patientData: Record<string, unknown>,
  passphrase = DEFAULT_LOCAL_SEED
): Promise<EncryptedQueueItem> {
  return enqueueOfflineItem('patient_registration', patientData, passphrase);
}

export async function enqueueOfflineScreening(
  screeningData: Record<string, unknown>,
  passphrase = DEFAULT_LOCAL_SEED
): Promise<EncryptedQueueItem> {
  return enqueueOfflineItem('screening_submission', screeningData, passphrase);
}

export async function enqueueOfflinePhoto(
  photoPayload: { photoBase64: string; caseId?: string; anatomicalSite?: string },
  passphrase = DEFAULT_LOCAL_SEED
): Promise<EncryptedQueueItem> {
  return enqueueOfflineItem('screening_photo', photoPayload, passphrase);
}

export async function enqueueOfflineNotes(
  notesPayload: { caseId?: string; consultationId?: string; observations: string; recommendations: string },
  passphrase = DEFAULT_LOCAL_SEED
): Promise<EncryptedQueueItem> {
  return enqueueOfflineItem('clinical_notes', notesPayload, passphrase);
}

export async function enqueueOfflineAppointment(
  appointmentPayload: { patientId: string; hospitalId: string; slotTime: string },
  passphrase = DEFAULT_LOCAL_SEED
): Promise<EncryptedQueueItem> {
  return enqueueOfflineItem('appointment_request', appointmentPayload, passphrase);
}

/**
 * Wipes all offline queues, local screenings, and cached items.
 * Triggered on logout and on device revocation.
 */
export async function wipeOfflineQueue(): Promise<void> {
  await db.clearAllOfflineData();
}

export interface SyncBatchResult {
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  results: any[];
}

/**
 * Dispatches all pending encrypted queue items to the server.
 * Handles:
 * - Decryption just-in-time
 * - Conflict detection and state recording
 * - Exponential backoff retry
 * - Queue wipe on device revocation (401 DEVICE_REVOKED)
 * - Idempotency preservation
 */
export async function syncOfflineQueue(
  accessToken: string,
  passphrase = DEFAULT_LOCAL_SEED
): Promise<SyncBatchResult> {
  const pendingItems = await db.encryptedQueue
    .where('status')
    .anyOf(['pending', 'failed'])
    .toArray();

  if (pendingItems.length === 0) {
    return { syncedCount: 0, failedCount: 0, conflictCount: 0, results: [] };
  }

  const batchPayloads: Array<{
    clientMutationId: string;
    type: OfflineActionType;
    payload: any;
    queueId: number;
    originalSha256?: string;
  }> = [];

  for (const item of pendingItems) {
    try {
      const decrypted = await decryptPayload<any>(item, passphrase);
      batchPayloads.push({
        clientMutationId: item.clientMutationId,
        type: item.type,
        payload: decrypted,
        queueId: item.id!,
        originalSha256: item.originalSha256,
      });
    } catch {
      await db.encryptedQueue.update(item.id!, {
        status: 'failed',
        retryCount: item.retryCount + 1,
      });
    }
  }

  if (batchPayloads.length === 0) {
    return { syncedCount: 0, failedCount: pendingItems.length, conflictCount: 0, results: [] };
  }

  try {
    const res = await fetch('/api/v1/sync/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: batchPayloads.map((b) => ({
          clientMutationId: b.clientMutationId,
          type: b.type,
          payload: b.payload,
          originalSha256: b.originalSha256,
        })),
      }),
    });

    // 1. Device Revocation Check: Automatic queue wipe on 401 DEVICE_REVOKED
    if (res.status === 401) {
      const errEnvelope = await res.json().catch(() => ({}));
      if (errEnvelope.error?.code === 'DEVICE_REVOKED') {
        await wipeOfflineQueue();
        throw new Error('DEVICE_REVOKED: This device has been revoked. Offline queue wiped for patient privacy.');
      }
    }

    const envelope = await res.json();
    if (!res.ok || !envelope.success) {
      throw new Error(envelope.error?.message || 'Sync batch request rejected');
    }

    const serverResults = envelope.data?.results || [];
    let syncedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    for (const b of batchPayloads) {
      const match = serverResults.find((r: any) => r.clientMutationId === b.clientMutationId);

      if (match?.status === 'conflict') {
        conflictCount += 1;
        await db.encryptedQueue.update(b.queueId, {
          status: 'conflict',
          conflictDetails: match.conflictDetails || {
            resolutionState: 'pending_review',
            message: 'Server detected conflicting record version.',
          },
        });
      } else if (match?.status === 'failed') {
        failedCount += 1;
        const currentItem = await db.encryptedQueue.get(b.queueId);
        const nextRetry = (currentItem?.retryCount || 0) + 1;
        await db.encryptedQueue.update(b.queueId, {
          status: 'failed',
          retryCount: nextRetry,
          lastRetryAt: Date.now(),
          backoffDelayMs: calculateBackoffDelay(nextRetry),
        });
      } else {
        // Success or replayed_without_mutation
        syncedCount += 1;
        await db.encryptedQueue.update(b.queueId, {
          status: 'synced',
          syncedAt: Date.now(),
        });
      }
    }

    return {
      syncedCount,
      failedCount,
      conflictCount,
      results: serverResults,
    };
  } catch (err: any) {
    // Increment retry count with exponential backoff
    for (const b of batchPayloads) {
      const record = await db.encryptedQueue.get(b.queueId);
      if (record && record.status !== 'conflict') {
        const nextRetry = record.retryCount + 1;
        await db.encryptedQueue.update(b.queueId, {
          retryCount: nextRetry,
          lastRetryAt: Date.now(),
          backoffDelayMs: calculateBackoffDelay(nextRetry),
          status: 'failed',
        });
      }
    }
    throw err;
  }
}
