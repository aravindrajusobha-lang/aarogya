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

export class AarogyaDatabase extends Dexie {
  screenings!: Table<OfflineScreening, number>;
  syncQueue!: Table<SyncQueueItem, number>;
  camps!: Table<CachedCamp, string>;

  constructor() {
    super('AarogyaDrishtiSimulationDB');
    this.version(1).stores({
      screenings: '++id, patientDemoId, campId, syncStatus, createdAt',
      syncQueue: '++id, action, retryCount, createdAt',
      camps: 'campId, panchayat, targetDate, active',
    });
  }
}

export const db = new AarogyaDatabase();
