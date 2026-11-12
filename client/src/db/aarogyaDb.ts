import Dexie, { Table } from 'dexie';

export interface OfflineScreening {
  id?: number;
  patientDemoId: string;
  campId: string;
  ashaId: string;
  visualFindings: {
    lesionObserved: boolean;
    lesionType?: string;
    anatomicalSite?: string;
  };
  demoRiskTier: 'Tier 1' | 'Tier 2' | 'Tier 3';
  photoDataUrl?: string;
  notes?: string;
  syncStatus: 'local_pending' | 'syncing' | 'synced' | 'sync_failed';
  createdAt: number;
}

export interface OfflineAiScreening {
  id?: number;
  clientId: string;
  patientId: string;
  hospitalId?: string;
  label?: string | null;
  confidence?: number;
  probabilities?: Record<string, number>;
  referToSpecialist?: boolean;
  moduleA?: any;
  moduleB?: any;
  moduleC?: any;
  combinedRecommendation?: any;
  consentGiven?: boolean;
  consentTimestamp?: string;
  photoDataUrl?: string;
  dentalPhotoDataUrl?: string;
  syncStatus: 'PENDING_SYNC' | 'SYNCED' | 'FAILED';
  createdAt: number;
}

export interface SyncQueueItem {
  id?: number;
  action: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  payload: Record<string, unknown>;
  retryCount: number;
  lastAttemptAt?: number;
  createdAt: number;
}

export interface CachedCamp {
  campId: string;
  name: string;
  location: string;
  panchayat: string;
  targetDate: string;
  active: boolean;
}

export type OfflineActionType =
  | 'patient_registration'
  | 'screening_submission'
  | 'screening_photo'
  | 'clinical_notes'
  | 'appointment_request'
  | 'referral_request'
  | 'ai_screening';

export interface EncryptedQueueItem {
  id?: number;
  clientMutationId: string;
  type: OfflineActionType;
  ciphertext: string;
  iv: string;
  salt: string;
  algorithm: 'AES-GCM-256';
  tagLength: 128;
  originalSha256?: string; // Checksum for byte-identical verification
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
  conflictDetails?: {
    serverVersion?: number;
    localVersion?: number;
    conflictingEntityId?: string;
    resolutionState: 'pending_review' | 'server_wins' | 'local_override';
    message?: string;
  };
  retryCount: number;
  lastRetryAt?: number;
  backoffDelayMs?: number;
  createdAt: number;
  syncedAt?: number;
}

export class AarogyaDatabase extends Dexie {
  screenings!: Table<OfflineScreening, number>;
  syncQueue!: Table<SyncQueueItem, number>;
  camps!: Table<CachedCamp, string>;
  encryptedQueue!: Table<EncryptedQueueItem, number>;
  offlineAiScreenings!: Table<OfflineAiScreening, number>;

  constructor() {
    super('AarogyaDrishtiSimulationDB');
    this.version(1).stores({
      screenings: '++id, patientDemoId, campId, syncStatus, createdAt',
      syncQueue: '++id, action, retryCount, createdAt',
      camps: 'campId, panchayat, targetDate, active',
    });
    this.version(2).stores({
      screenings: '++id, patientDemoId, campId, syncStatus, createdAt',
      syncQueue: '++id, action, retryCount, createdAt',
      camps: 'campId, panchayat, targetDate, active',
      encryptedQueue: '++id, clientMutationId, type, status, createdAt',
    });
    this.version(3).stores({
      screenings: '++id, patientDemoId, campId, syncStatus, createdAt',
      syncQueue: '++id, action, retryCount, createdAt',
      camps: 'campId, panchayat, targetDate, active',
      encryptedQueue: '++id, clientMutationId, type, status, createdAt',
    });
    this.version(4).stores({
      screenings: '++id, patientDemoId, campId, syncStatus, createdAt',
      syncQueue: '++id, action, retryCount, createdAt',
      camps: 'campId, panchayat, targetDate, active',
      encryptedQueue: '++id, clientMutationId, type, status, createdAt',
      offlineAiScreenings: '++id, clientId, patientId, syncStatus, createdAt',
    });
  }

  /**
   * Completely wipes offline queues and local caches on logout or device revocation.
   */
  async clearAllOfflineData(): Promise<void> {
    await this.transaction('rw', [this.screenings, this.syncQueue, this.encryptedQueue, this.offlineAiScreenings], async () => {
      await this.encryptedQueue.clear();
      await this.screenings.clear();
      await this.syncQueue.clear();
      await this.offlineAiScreenings.clear();
    });
  }
}

export const db = new AarogyaDatabase();
