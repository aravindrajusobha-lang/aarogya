import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { logger } from '../../config/logger.js';
import { AuditLog } from '../audit/auditModel.js';

export interface BackupManifestItem {
  collection: string;
  count: number;
  sha256: string;
}

export interface BackupManifest {
  backupId: string;
  createdAt: string;
  environment: string;
  simulation: true;
  totalCollections: number;
  totalDocuments: number;
  manifestSha256?: string;
  collections: BackupManifestItem[];
}

export class BackupService {
  /**
   * Creates a full database backup archive.
   * Dumps each collection to JSON with SHA-256 manifest verification.
   */
  static async createBackup(outputDir: string): Promise<{
    backupId: string;
    backupPath: string;
    manifest: BackupManifest;
  }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `backup_aarogya_${timestamp}`;
    const backupPath = path.join(outputDir, backupId);

    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not active');
    }

    const collections = await db.listCollections().toArray();
    const manifestItems: BackupManifestItem[] = [];
    let totalDocuments = 0;

    for (const col of collections) {
      const collectionName = col.name;
      // Skip system collections
      if (collectionName.startsWith('system.')) continue;

      const cursor = db.collection(collectionName).find({});
      const docs = await cursor.toArray();
      const count = docs.length;
      totalDocuments += count;

      const serialized = JSON.stringify(docs, null, 2);
      const sha256 = crypto.createHash('sha256').update(serialized).digest('hex');

      const colFilePath = path.join(backupPath, `${collectionName}.json`);
      fs.writeFileSync(colFilePath, serialized, 'utf8');

      manifestItems.push({
        collection: collectionName,
        count,
        sha256,
      });
    }

    const manifest: BackupManifest = {
      backupId,
      createdAt: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      simulation: true,
      totalCollections: manifestItems.length,
      totalDocuments,
      collections: manifestItems,
    };

    const manifestRaw = JSON.stringify(manifest, null, 2);
    manifest.manifestSha256 = crypto.createHash('sha256').update(manifestRaw).digest('hex');

    const manifestPath = path.join(backupPath, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    logger.info({
      event: 'backup_created',
      backupId,
      backupPath,
      totalCollections: manifest.totalCollections,
      totalDocuments,
    });

    try {
      await AuditLog.create({
        action: 'system.backup_created',
        resourceType: 'system_backup',
        resourceId: backupId,
        actorId: 'system_admin',
        actorRole: 'system_admin',
        ip: '127.0.0.1',
        statusCode: 200,
        metadata: {
          backupId,
          totalCollections: manifest.totalCollections,
          totalDocuments,
        },
        simulation: true,
      });
    } catch {
      // Non-fatal if audit collection was dumped
    }

    return {
      backupId,
      backupPath,
      manifest,
    };
  }

  /**
   * Restores a database from a backup archive with strict SHA-256 integrity checks.
   */
  static async restoreBackup(backupPath: string): Promise<{
    restoredCollections: number;
    restoredDocuments: number;
    verified: boolean;
  }> {
    const manifestPath = path.join(backupPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Backup manifest not found at ${manifestPath}`);
    }

    const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection is not active');
    }

    let restoredDocuments = 0;
    let restoredCollections = 0;

    for (const item of manifest.collections) {
      const colFilePath = path.join(backupPath, `${item.collection}.json`);
      if (!fs.existsSync(colFilePath)) {
        throw new Error(`Collection file missing: ${colFilePath}`);
      }

      const fileContent = fs.readFileSync(colFilePath, 'utf8');
      const calculatedSha = crypto.createHash('sha256').update(fileContent).digest('hex');
      if (calculatedSha !== item.sha256) {
        throw new Error(
          `Integrity checksum mismatch for collection ${item.collection}. Expected ${item.sha256}, got ${calculatedSha}`
        );
      }

      const docs = JSON.parse(fileContent);
      const collection = db.collection(item.collection);

      // Clear existing records in collection
      await collection.deleteMany({});

      if (docs.length > 0) {
        // Convert ISO date strings back to Date objects and _id appropriately
        const parsedDocs = docs.map((doc: any) => {
          return restoreDateObjects(doc);
        });
        await collection.insertMany(parsedDocs);
      }

      restoredDocuments += docs.length;
      restoredCollections++;
    }

    logger.info({
      event: 'backup_restored',
      backupId: manifest.backupId,
      restoredCollections,
      restoredDocuments,
    });

    try {
      await AuditLog.create({
        action: 'system.backup_restored',
        resourceType: 'system_backup',
        resourceId: manifest.backupId,
        actorId: 'system_admin',
        actorRole: 'system_admin',
        ip: '127.0.0.1',
        statusCode: 200,
        metadata: {
          backupId: manifest.backupId,
          restoredCollections,
          restoredDocuments,
        },
        simulation: true,
      });
    } catch {
      // Non-fatal
    }

    return {
      restoredCollections,
      restoredDocuments,
      verified: true,
    };
  }
}

/**
 * Recursively restores ISO date strings to native Date instances
 */
function restoreDateObjects(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // ISO 8601 date string check
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(obj)) {
      return new Date(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => restoreDateObjects(item));
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = restoreDateObjects(obj[key]);
    }
    return res;
  }
  return obj;
}
