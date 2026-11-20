import { HealthWorkerAssignment } from '../assignment/assignmentModel.js';
import { Patient } from './patientModel.js';
import { Village } from '../reference/villageModel.js';

export const FIELD_WORKER_ROLES = new Set(['asha', 'asha_worker', 'anm']);

export class PatientScopeError extends Error {
  statusCode = 403;
  code = 'PATIENT_SCOPE_DENIED';

  constructor(message: string) {
    super(message);
    this.name = 'PatientScopeError';
  }
}

export async function getActiveWorkerAssignment(workerId: string) {
  return HealthWorkerAssignment.findOne({ workerId, status: 'active' }).lean();
}

export async function getWorkerAccessiblePatient(workerId: string, authenticatedHospitalId: string | undefined, patientId: string) {
  const [assignment, patient] = await Promise.all([
    getActiveWorkerAssignment(workerId),
    Patient.findOne({ patientId }).select('patientId villageId hospitalId registeredBy').lean(),
  ]);
  if (!patient) return null;

  const assignedVillages = assignment?.assignedVillages || [];
  const hospitalId = assignment?.hospitalId || authenticatedHospitalId;
  if (!hospitalId || patient.hospitalId !== hospitalId) return null;

  if (assignedVillages.length > 0) {
    return assignedVillages.includes(patient.villageId) ? { hospitalId, patient } : null;
  }

  return patient.registeredBy === workerId ? { hospitalId, patient } : null;
}

export async function resolveWorkerPatientScope(input: {
  workerId: string;
  authenticatedHospitalId?: string;
  requestedHospitalId?: string;
  mandal: string;
  villageId?: string;
  villageName: string;
}): Promise<{ hospitalId: string; mandal: string; villageId: string; villageName: string; scopeType: 'assignment' | 'facility' }> {
  const assignment = await getActiveWorkerAssignment(input.workerId);
  const assignedVillages = assignment?.assignedVillages || [];
  const hasVillageAssignment = assignedVillages.length > 0;
  const hospitalId = assignment?.hospitalId || input.authenticatedHospitalId;

  if (!hospitalId) {
    throw new PatientScopeError('Your account must be linked to a healthcare facility before registering patients.');
  }
  if (input.requestedHospitalId && input.requestedHospitalId !== hospitalId) {
    throw new PatientScopeError('Patients may only be registered under your assigned facility.');
  }
  if (hasVillageAssignment
    && input.mandal.trim().toLowerCase() !== (assignment?.assignedMandal || '').trim().toLowerCase()) {
    throw new PatientScopeError('Choose a village in your assigned mandal.');
  }
  if (input.villageId && hasVillageAssignment && !assignedVillages.includes(input.villageId)) {
    throw new PatientScopeError('Choose a village assigned to your account.');
  }

  const escapeRegex = (value: string) => value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const villageFilter: Record<string, unknown> = {
    hospitalId,
    villageName: { $regex: new RegExp(`^${escapeRegex(input.villageName)}$`, 'i') },
    mandal: { $regex: new RegExp(`^${escapeRegex(input.mandal)}$`, 'i') },
  };
  if (input.villageId) {
    villageFilter.villageId = input.villageId;
  } else if (hasVillageAssignment) {
    villageFilter.villageId = { $in: assignedVillages };
  }

  const village = await Village.findOne(villageFilter).select('villageId villageName mandal hospitalId').lean();
  if (village && (!hasVillageAssignment || assignedVillages.includes(village.villageId))) {
    if (village.hospitalId !== hospitalId) {
      throw new PatientScopeError('The selected village is outside your assigned facility.');
    }

    return {
      hospitalId,
      mandal: village.mandal,
      villageId: village.villageId,
      villageName: village.villageName,
      scopeType: hasVillageAssignment ? 'assignment' : 'facility',
    };
  }

  if (input.villageId) {
    throw new PatientScopeError(hasVillageAssignment
      ? 'Choose a village assigned to your account.'
      : 'Choose an active village in your assigned healthcare facility.');
  }

  const jurisdictionVillage = await Village.findOne({
    hospitalId,
    mandal: { $regex: new RegExp(`^${escapeRegex(input.mandal)}$`, 'i') },
    ...(hasVillageAssignment ? { villageId: { $in: assignedVillages } } : {}),
  })
    .sort({ villageId: 1 })
    .select('villageId villageName mandal hospitalId')
    .lean();

  if (!jurisdictionVillage) {
    throw new PatientScopeError(hasVillageAssignment
      ? 'Choose a village in your assigned mandal.'
      : 'Choose a mandal with active villages in your assigned healthcare facility.');
  }

  return {
    hospitalId,
    mandal: jurisdictionVillage.mandal,
    villageId: jurisdictionVillage.villageId,
    villageName: input.villageName.trim(),
    scopeType: hasVillageAssignment ? 'assignment' : 'facility',
  };
}
