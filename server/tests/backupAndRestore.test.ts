import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { BackupService } from '../src/modules/backup/backupService.js';
import { runMasterSeed } from '../src/modules/seed/masterSeed.js';
import { Patient } from '../src/modules/patient/patientModel.js';
import { ScreeningCase } from '../src/modules/screening/screeningCaseModel.js';
import { Biopsy } from '../src/modules/biopsy/biopsyModel.js';
import { Referral } from '../src/modules/referral/referralModel.js';
import { User } from '../src/modules/auth/userModel.js';
import { Hospital } from '../src/modules/hospital/hospitalModel.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 20: Backup & Disaster Recovery Verification', () => {
  let replSet: MongoMemoryReplSet;
  let tempBackupDir: string;
  let generatedBackupPath: string;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsBackupTest');
    const uri = replSet.getUri();
    await mongoose.connect(uri);

    tempBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aarogya-backup-test-'));

    // Populate database with comprehensive master seed
    await runMasterSeed();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
    if (tempBackupDir && fs.existsSync(tempBackupDir)) {
      fs.rmSync(tempBackupDir, { recursive: true, force: true });
    }
  });

  it('Step 1: Executes full database backup and generates verified SHA-256 manifest', async () => {
    const originalPatientCount = await Patient.countDocuments();
    const originalUserCount = await User.countDocuments();
    const originalHospitalCount = await Hospital.countDocuments();

    expect(originalPatientCount).toBeGreaterThanOrEqual(2);
    expect(originalUserCount).toBeGreaterThanOrEqual(6);
    expect(originalHospitalCount).toBeGreaterThanOrEqual(3);

    const backupResult = await BackupService.createBackup(tempBackupDir);
    generatedBackupPath = backupResult.backupPath;

    expect(fs.existsSync(generatedBackupPath)).toBe(true);
    expect(backupResult.manifest.simulation).toBe(true);
    expect(backupResult.manifest.totalCollections).toBeGreaterThan(5);
    expect(backupResult.manifest.manifestSha256).toBeDefined();

    // Verify manifest.json exists on disk
    const manifestOnDisk = JSON.parse(
      fs.readFileSync(path.join(generatedBackupPath, 'manifest.json'), 'utf8')
    );
    expect(manifestOnDisk.backupId).toBe(backupResult.backupId);

    // Verify patient collection file exists
    const patientBackupFile = path.join(generatedBackupPath, 'patients.json');
    expect(fs.existsSync(patientBackupFile)).toBe(true);
    const patientData = JSON.parse(fs.readFileSync(patientBackupFile, 'utf8'));
    expect(patientData.length).toBe(originalPatientCount);
  });

  it('Step 2: Simulates disastrous data loss by clearing clinical and master collections', async () => {
    // Purge key clinical records
    await Patient.deleteMany({});
    await ScreeningCase.deleteMany({});
    await Biopsy.deleteMany({});
    await Referral.deleteMany({});

    expect(await Patient.countDocuments()).toBe(0);
    expect(await ScreeningCase.countDocuments()).toBe(0);
    expect(await Biopsy.countDocuments()).toBe(0);
    expect(await Referral.countDocuments()).toBe(0);
  });

  it('Step 3: Restores database from backup archive and verifies 100% data integrity', async () => {
    const restoreResult = await BackupService.restoreBackup(generatedBackupPath);

    expect(restoreResult.verified).toBe(true);
    expect(restoreResult.restoredCollections).toBeGreaterThan(5);
    expect(restoreResult.restoredDocuments).toBeGreaterThan(10);

    // Verify records are fully restored
    const restoredPatients = await Patient.find({});
    expect(restoredPatients.length).toBeGreaterThanOrEqual(2);

    const balaram = await Patient.findOne({ patientId: 'PAT-PAD-2026-001' });
    expect(balaram).toBeDefined();
    expect(balaram?.fullName).toBe('Vantala Balaram');
    expect(balaram?.villageId).toBe('vil_dumbriguda_03');
    expect(balaram?.originalAddressText).toBe('Near Old Mango Tree, Dumbriguda Tribal Hamlet');

    const restoredCases = await ScreeningCase.find({});
    expect(restoredCases.length).toBeGreaterThanOrEqual(1);

    const restoredBiopsies = await Biopsy.find({});
    expect(restoredBiopsies.length).toBeGreaterThanOrEqual(1);

    const restoredReferrals = await Referral.find({});
    expect(restoredReferrals.length).toBeGreaterThanOrEqual(1);
  });

  it('Step 4: Rejects corrupted backup archives with SHA-256 checksum mismatch', async () => {
    // Corrupt one collection file
    const patientBackupFile = path.join(generatedBackupPath, 'patients.json');
    fs.appendFileSync(patientBackupFile, '   \n/* TAMPERED DATA */');

    await expect(BackupService.restoreBackup(generatedBackupPath)).rejects.toThrow(
      /Integrity checksum mismatch/
    );
  });
});
