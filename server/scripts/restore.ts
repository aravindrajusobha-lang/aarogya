#!/usr/bin/env tsx
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { BackupService } from '../src/modules/backup/backupService.js';
import { logger } from '../src/config/logger.js';

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) {
    console.error('❌ Usage: npx tsx scripts/restore.ts <path-to-backup-folder>');
    process.exit(1);
  }

  logger.info({ event: 'cli_restore_invoked', backupPath });

  await connectDatabase();
  try {
    const result = await BackupService.restoreBackup(backupPath);
    logger.info({
      event: 'cli_restore_success',
      restoredCollections: result.restoredCollections,
      restoredDocuments: result.restoredDocuments,
      verified: result.verified,
    });
    console.log(`\n✅ Database restored successfully from: ${backupPath}`);
    console.log(`   Collections: ${result.restoredCollections} | Documents: ${result.restoredDocuments}\n`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('❌ Restore failed:', err);
  process.exit(1);
});
