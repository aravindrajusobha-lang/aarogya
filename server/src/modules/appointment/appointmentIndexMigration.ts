import { logger } from '../../config/logger.js';
import { Appointment, LEGACY_APPOINTMENT_SLOT_INDEX_NAME } from './appointmentModel.js';

/**
 * The original unique slot index was facility-wide, which blocked two doctors at the same facility
 * from seeing patients at the same time. Drop it (if present) and build the per-doctor index.
 * Idempotent and safe to run on every start.
 */
export async function migrateAppointmentSlotIndex(): Promise<void> {
  try {
    const indexes = await Appointment.collection.indexes().catch(() => [] as any[]);
    if (indexes.some((index: any) => index.name === LEGACY_APPOINTMENT_SLOT_INDEX_NAME)) {
      await Appointment.collection.dropIndex(LEGACY_APPOINTMENT_SLOT_INDEX_NAME);
      logger.info({ event: 'appointment_index_migrated' }, 'Replaced facility-wide slot index with per-doctor index');
    }
    await Appointment.createIndexes();
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Appointment slot index migration skipped');
  }
}
