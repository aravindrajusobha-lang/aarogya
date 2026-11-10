#!/usr/bin/env tsx
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { BackupService } from '../src/modules/backup/backupService.js';
import { logger } from '../src/config/logger.js';

async function main() {
  const outputDir = process.argv[2] || path.join(process.cwd(), 'backups');
  logger.info({ event: 'cli_backup_invoked', outputDir });

  await connectDatabase();
  try {
    const result = await BackupService.createBackup(outputDir);
    logger.info({
      event: 'cli_backup_success',
      backupId: result.backupId,
      backupPath: result.backupPath,
      totalCollections: result.manifest.totalCollections,
      totalDocuments: result.manifest.totalDocuments,
    });
    console.log(`\n✅ Backup successfully generated: ${result.backupPath}\n`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('❌ Backup failed:', err);
  process.exit(1);
});
