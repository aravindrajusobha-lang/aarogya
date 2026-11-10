import { EventEmitter } from 'events';
import { AuditLog } from '../audit/auditModel.js';
import { logger } from '../../config/logger.js';
import { VillageGroupService } from '../villageGroup/villageGroupService.js';

export interface PatientRegisteredEvent {
  patientId: string;
  fullName: string;
  villageId: string;
  mandal: string;
  originalAddressText: string;
  registeredBy: string;
  isDuplicateCandidate: boolean;
  timestamp: Date;
  simulation: boolean;
}

class PatientEventEmitter extends EventEmitter {
  async emitAsync(event: string, ...args: any[]): Promise<boolean> {
    const listeners = this.rawListeners(event);
    await Promise.all(
      listeners.map(async (fn) => {
        try {
          await fn(...args);
        } catch (err: any) {
          logger.error({ err: err.message, event }, 'Error in async event listener');
        }
      })
    );
    return true;
  }
}

export const patientEvents = new PatientEventEmitter();


// Listener for patient.registered domain event
patientEvents.on('patient.registered', async (event: PatientRegisteredEvent) => {
  logger.info(
    {
      event: 'patient.registered',
      patientId: event.patientId,
      villageId: event.villageId,
      mandal: event.mandal,
      isDuplicateCandidate: event.isDuplicateCandidate,
    },
    `Domain Event: patient.registered emitted for ${event.patientId}`
  );

  try {
    await AuditLog.create({
      action: 'PATIENT_REGISTERED',
      actorId: event.registeredBy,
      actorRole: 'staff',
      resourceType: 'patient',
      resourceId: event.patientId,
      ip: '127.0.0.1',
      userAgent: 'AarogyaDrishti/SyncEngine',
      statusCode: 201,
      metadata: {
        villageId: event.villageId,
        mandal: event.mandal,
        isDuplicateCandidate: event.isDuplicateCandidate,
        hasOriginalAddressText: Boolean(event.originalAddressText),
      },
      simulation: true,
    });
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed to write audit record for patient.registered event');
  }

  // Phase 7: Automatic Village Group Management
  try {
    await VillageGroupService.handlePatientRegistered(event);
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (
      errMsg.includes('client was closed') ||
      errMsg.includes('must be connected') ||
      errMsg.includes('topology was closed')
    ) {
      logger.debug(
        { err: errMsg, patientId: event.patientId, villageId: event.villageId },
        'Village group handling interrupted during client shutdown'
      );
    } else {
      logger.error(
        { err: errMsg, patientId: event.patientId, villageId: event.villageId },
        'Error during automatic village group handling for registered patient'
      );
    }
  }
});

