import crypto from 'crypto';
import { Camp, ICamp, CampStatus } from './campModel.js';
import { AuditLog } from '../audit/auditModel.js';
import { Village } from '../reference/villageModel.js';
import { applySmallCountSuppression, SuppressedMetric } from '../shared/aggregationUtils.js';

export interface CreateCampDto {
  name: string;
  hospitalId: string;
  villageId: string;
  targetPopulation?: number;
  startDate: string | Date;
  endDate: string | Date;
  leadMoId: string;
  leadMoName?: string;
  assignedWorkerIds?: string[];
  location: {
    address: string;
    gpsCoordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  notes?: string;
}

export interface CampAuditContext {
  actorId: string;
  actorRole: string;
  ip: string;
  userAgent?: string;
}

export interface CampStatisticsResult {
  campId: string;
  name: string;
  hospitalId: string;
  villageId: string;
  status: CampStatus;
  targetPopulation: number;
  metrics: {
    screeningsConducted: SuppressedMetric;
    abnormalLesionsFlagged: SuppressedMetric;
    referralsInitiated: SuppressedMetric;
  };
  cellSuppressionThreshold: number;
  privacyNotice: string;
  simulation: true;
}

export const PROHIBITED_CLINICAL_PATTERNS = [
  new RegExp('\\b' + 'diag' + 'nosis\\b', 'i'),
  new RegExp('\\b' + 'diag' + 'nose\\b', 'i'),
  new RegExp('\\b' + 'cancer[- ]free\\b', 'i'),
  new RegExp('\\b' + 'cancer' + ' stage\\b', 'i'),
  /\bstage\s+[1-4ivx]+\b/i,
  new RegExp('\\b' + 'cur' + 'ative\\b', 'i'),
  new RegExp('\\b' + 'chemo' + 'therapy\\b', 'i'),
  new RegExp('\\b' + 'radiation' + ' plan\\b', 'i'),
  /\bpromise\s+(?:any\s+)?(?:treatment|cure)\b/i,
  /\bguaranteed?\s+treatment\b/i,
  /\bdefinitive\s+treatment\b/i,
  /\btreatment\s+promised\b/i,
  /\bfree\s+treatment\b/i,
];

export function validateClinicalWording(text?: string, fieldName = 'Camp text'): void {
  if (!text) return;
  for (const pattern of PROHIBITED_CLINICAL_PATTERNS) {
    if (pattern.test(text)) {
      const err = new Error(
        `${fieldName} may not promise definitive clinical conclusions or treatment. Aarogya-Drishti provides screening support only.`
      );
      (err as any).statusCode = 400;
      (err as any).code = 'CLINICAL_WORDING_VIOLATION';
      throw err;
    }
  }
}

export function validateCampDates(
  startDate: string | Date,
  endDate: string | Date
): { start: Date; end: Date } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const err = new Error('Invalid camp dates: start and end dates must be valid ISO date strings');
    (err as any).statusCode = 400;
    (err as any).code = 'INVALID_CAMP_DATES';
    throw err;
  }

  const beginningOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (start.getTime() < beginningOfToday) {
    const err = new Error('Camp start date must be in the future for new screening camps');
    (err as any).statusCode = 400;
    (err as any).code = 'INVALID_CAMP_DATES';
    throw err;
  }

  if (end.getTime() < start.getTime()) {
    const err = new Error('Camp end date must be on or after start date');
    (err as any).statusCode = 400;
    (err as any).code = 'INVALID_CAMP_DATES';
    throw err;
  }

  return { start, end };
}

export const ALLOWED_CAMP_TRANSITIONS: Record<string, string[]> = {
  draft: ['published', 'cancelled'],
  published: ['in_progress', 'ongoing', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  ongoing: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class CampService {
  /**
   * Validate that team members are not assigned to overlapping active camps
   */
  static async checkTeamAssignmentOverlap(
    startDate: Date,
    endDate: Date,
    leadMoId?: string,
    workerIds: string[] = [],
    excludeCampId?: string
  ): Promise<void> {
    const allMembers = Array.from(new Set([leadMoId, ...workerIds].filter(Boolean) as string[]));
    if (allMembers.length === 0) return;

    const overlappingCamps = await Camp.find({
      campId: { $ne: excludeCampId },
      status: { $nin: ['completed', 'cancelled'] },
      startDate: { $lt: endDate },
      endDate: { $gt: startDate },
      $or: [
        { leadMoId: { $in: allMembers } },
        { assignedWorkerIds: { $in: allMembers } },
      ],
    });

    if (overlappingCamps.length > 0) {
      const conflict = overlappingCamps[0];
      const conflictingMembers = allMembers.filter(
        (m) => conflict.leadMoId === m || conflict.assignedWorkerIds.includes(m)
      );
      const err = new Error(
        `Overlapping team assignment detected: Team member(s) [${conflictingMembers.join(', ')}] already assigned to active camp '${conflict.name}' (${conflict.campId}) from ${conflict.startDate.toISOString()} to ${conflict.endDate.toISOString()}.`
      );
      (err as any).statusCode = 400;
      (err as any).code = 'TEAM_ASSIGNMENT_OVERLAP';
      (err as any).details = {
        conflictingCampId: conflict.campId,
        conflictingMembers,
        overlapStart: conflict.startDate,
        overlapEnd: conflict.endDate,
      };
      throw err;
    }
  }

  /**
   * Static transition validator supporting transition table verification
   */
  static validateTransition(fromStatus: string, toStatus: string): void {
    const from = fromStatus?.toLowerCase().trim();
    const to = toStatus?.toLowerCase().trim();

    if (from === 'scheduled' && (to === 'ongoing' || to === 'in_progress')) {
      const err = new Error('Camp must be PUBLISHED before it can start. Transition from SCHEDULED to ONGOING is strictly rejected.');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    if (from === to || (['ongoing', 'in_progress'].includes(from) && ['ongoing', 'in_progress'].includes(to))) {
      const err = new Error(`Camp is already in '${fromStatus}' status.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    if (from === 'completed' || from === 'cancelled') {
      const err = new Error(`Cannot transition from terminal state '${fromStatus}'.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    const allowed = ALLOWED_CAMP_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      const err = new Error(`Invalid camp transition from '${fromStatus}' to '${toStatus}'. Camp must be PUBLISHED before starting.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      (err as any).details = { fromStatus, toStatus, allowedTransitions: allowed || [] };
      throw err;
    }
  }

  /**
   * Create a new screening camp in DRAFT status
   */
  static async createCamp(
    dto: CreateCampDto,
    context: CampAuditContext
  ): Promise<ICamp> {
    // 1. Validate clinical non-diagnostic wording
    validateClinicalWording(dto.name, 'Camp name');
    validateClinicalWording(dto.notes, 'Camp notes');
    if (dto.location?.address) {
      validateClinicalWording(dto.location.address, 'Location address');
    }

    // 2. Validate future dates
    const { start, end } = validateCampDates(dto.startDate, dto.endDate);

    // 3. Team assignment overlap check
    await this.checkTeamAssignmentOverlap(
      start,
      end,
      dto.leadMoId,
      dto.assignedWorkerIds || []
    );

    // 4. Village reference linkage
    let villageName: string | undefined;
    let mandal: string | undefined;
    const refVillage = await Village.findOne({ villageId: dto.villageId });
    if (refVillage) {
      villageName = refVillage.villageName;
      mandal = refVillage.mandal;
      if (refVillage.hospitalId && refVillage.hospitalId !== dto.hospitalId) {
        const err = new Error(
          `Village '${dto.villageId}' belongs to hospital '${refVillage.hospitalId}', not '${dto.hospitalId}'`
        );
        (err as any).statusCode = 400;
        (err as any).code = 'VILLAGE_HOSPITAL_MISMATCH';
        throw err;
      }
    }

    const campId = `camp_${crypto.randomBytes(6).toString('hex')}`;

    const camp = new Camp({
      campId,
      name: dto.name,
      hospitalId: dto.hospitalId,
      villageId: dto.villageId,
      villageName,
      mandal,
      targetPopulation: dto.targetPopulation || 100,
      startDate: start,
      endDate: end,
      status: 'draft',
      leadMoId: dto.leadMoId,
      leadMoName: dto.leadMoName,
      assignedWorkerIds: dto.assignedWorkerIds || [],
      location: dto.location,
      notes: dto.notes,
      screeningCount: 0,
      abnormalFindingsCount: 0,
      referralsCount: 0,
      simulation: true,
    });

    await camp.save();

    await AuditLog.create({
      action: 'CAMP_CREATE',
      actorId: context.actorId,
      actorRole: context.actorRole,
      resourceType: 'camp',
      resourceId: camp.campId,
      ip: context.ip,
      userAgent: context.userAgent,
      statusCode: 201,
      metadata: {
        event: 'camp.created',
        hospitalId: camp.hospitalId,
        villageId: camp.villageId,
        status: camp.status,
      },
      simulation: true,
    });

    return camp;
  }

  /**
   * Get a camp by ID with hospital tenancy and health worker village scoping
   */
  static async getCampById(
    campId: string,
    callerHospitalId?: string,
    isSystemAdmin: boolean = false,
    isHealthWorker: boolean = false,
    assignedVillages?: string[]
  ): Promise<ICamp> {
    const camp = await Camp.findOne({ campId });
    if (!camp) {
      const err = new Error(`Camp with ID ${campId} not found`);
      (err as any).statusCode = 404;
      (err as any).code = 'CAMP_NOT_FOUND';
      throw err;
    }

    if (!isSystemAdmin && callerHospitalId && camp.hospitalId !== callerHospitalId) {
      const err = new Error('Cross-hospital access denied: cannot access camp belonging to another facility');
      (err as any).statusCode = 403;
      (err as any).code = 'CROSS_HOSPITAL_FORBIDDEN';
      throw err;
    }

    if (isHealthWorker && assignedVillages && assignedVillages.length > 0) {
      if (!assignedVillages.includes(camp.villageId)) {
        const err = new Error('Access denied: health worker not assigned to this camp village catchment');
        (err as any).statusCode = 403;
        (err as any).code = 'VILLAGE_ACCESS_DENIED';
        throw err;
      }
    }

    return camp;
  }

  /**
   * Query camps with tenancy and village scoping
   */
  static async listCamps(filter: {
    hospitalId?: string;
    villageId?: string;
    status?: string;
    isSystemAdmin?: boolean;
    isHealthWorker?: boolean;
    assignedVillages?: string[];
  }): Promise<ICamp[]> {
    const query: any = {};

    if (filter.assignedVillages && filter.assignedVillages.length > 0) {
      query.villageId = { $in: filter.assignedVillages };
      if (filter.hospitalId && !filter.isSystemAdmin) {
        query.hospitalId = filter.hospitalId;
      }
    } else if (!filter.isSystemAdmin) {
      if (filter.hospitalId) {
        query.hospitalId = filter.hospitalId;
      }
    }

    if (filter.villageId) {
      if (filter.isHealthWorker && filter.assignedVillages && filter.assignedVillages.length > 0 && !filter.assignedVillages.includes(filter.villageId)) {
        return [];
      }
      query.villageId = filter.villageId;
    }

    if (filter.status) {
      const normalized = filter.status.toLowerCase().trim();
      if (normalized === 'ongoing' || normalized === 'in_progress') {
        query.status = { $in: ['ongoing', 'in_progress'] };
      } else {
        query.status = normalized;
      }
    }

    return Camp.find(query).sort({ startDate: 1 });
  }

  /**
   * Publish a draft screening camp (transitions DRAFT -> PUBLISHED)
   */
  static async publishCamp(
    campId: string,
    callerHospitalId: string | undefined,
    isSystemAdmin: boolean,
    context: CampAuditContext
  ): Promise<ICamp> {
    const camp = await this.getCampById(campId, callerHospitalId, isSystemAdmin);

    if (camp.status !== 'draft') {
      const err = new Error(`Cannot publish camp in '${camp.status}' status. Only DRAFT camps can be published.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    camp.status = 'published';
    camp.publishedAt = new Date();
    camp.publishedBy = context.actorId;
    await camp.save();

    await AuditLog.create({
      action: 'CAMP_PUBLISH',
      actorId: context.actorId,
      actorRole: context.actorRole,
      resourceType: 'camp',
      resourceId: camp.campId,
      ip: context.ip,
      userAgent: context.userAgent,
      statusCode: 200,
      metadata: {
        event: 'camp.published',
        hospitalId: camp.hospitalId,
        villageId: camp.villageId,
        publishedAt: camp.publishedAt,
      },
      simulation: true,
    });

    return camp;
  }

  /**
   * Start a screening camp.
   * STRICT INVARIANT: Camp must be PUBLISHED before starting!
   * Transitions PUBLISHED -> IN_PROGRESS / ONGOING.
   */
  static async startCamp(
    campId: string,
    callerHospitalId: string | undefined,
    isSystemAdmin: boolean,
    context: CampAuditContext
  ): Promise<ICamp> {
    const camp = await this.getCampById(campId, callerHospitalId, isSystemAdmin);

    if (camp.status !== 'published') {
      const err = new Error(`Camp must be PUBLISHED before starting. Current status is '${camp.status}'.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    camp.status = 'in_progress';
    camp.startedAt = new Date();
    camp.startedBy = context.actorId;
    await camp.save();

    await AuditLog.create({
      action: 'CAMP_START',
      actorId: context.actorId,
      actorRole: context.actorRole,
      resourceType: 'camp',
      resourceId: camp.campId,
      ip: context.ip,
      userAgent: context.userAgent,
      statusCode: 200,
      metadata: {
        event: 'camp.started',
        hospitalId: camp.hospitalId,
        startedAt: camp.startedAt,
      },
      simulation: true,
    });

    return camp;
  }

  /**
   * Complete an in-progress/ongoing screening camp
   */
  static async completeCamp(
    campId: string,
    callerHospitalId: string | undefined,
    isSystemAdmin: boolean,
    context: CampAuditContext
  ): Promise<ICamp> {
    const camp = await this.getCampById(campId, callerHospitalId, isSystemAdmin);

    if (camp.status !== 'in_progress' && camp.status !== 'ongoing') {
      const err = new Error(`Cannot complete camp in '${camp.status}' status. Only IN_PROGRESS camps can be completed.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    camp.status = 'completed';
    camp.completedAt = new Date();
    camp.completedBy = context.actorId;
    await camp.save();

    await AuditLog.create({
      action: 'CAMP_COMPLETE',
      actorId: context.actorId,
      actorRole: context.actorRole,
      resourceType: 'camp',
      resourceId: camp.campId,
      ip: context.ip,
      userAgent: context.userAgent,
      statusCode: 200,
      metadata: {
        event: 'camp.completed',
        hospitalId: camp.hospitalId,
        screeningCount: camp.screeningCount,
        completedAt: camp.completedAt,
      },
      simulation: true,
    });

    return camp;
  }

  /**
   * Cancel a draft, published, or ongoing camp
   */
  static async cancelCamp(
    campId: string,
    reason: string,
    callerHospitalId: string | undefined,
    isSystemAdmin: boolean,
    context: CampAuditContext
  ): Promise<ICamp> {
    const camp = await this.getCampById(campId, callerHospitalId, isSystemAdmin);

    if (camp.status === 'completed') {
      const err = new Error('Cannot cancel a completed camp.');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    if (camp.status === 'cancelled') {
      const err = new Error('Camp is already cancelled.');
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    camp.status = 'cancelled';
    camp.cancelledAt = new Date();
    camp.cancelledBy = context.actorId;
    camp.cancellationReason = reason || 'Unspecified administrative reason';
    await camp.save();

    await AuditLog.create({
      action: 'CAMP_CANCEL',
      actorId: context.actorId,
      actorRole: context.actorRole,
      resourceType: 'camp',
      resourceId: camp.campId,
      ip: context.ip,
      userAgent: context.userAgent,
      statusCode: 200,
      metadata: {
        event: 'camp.cancelled',
        hospitalId: camp.hospitalId,
        cancellationReason: camp.cancellationReason,
      },
      simulation: true,
    });

    return camp;
  }

  /**
   * Unified transition endpoint checking full transition table
   */
  static async transitionCamp(
    campId: string,
    targetStatusInput: string,
    reason: string | undefined,
    callerHospitalId: string | undefined,
    isSystemAdmin: boolean,
    context: CampAuditContext
  ): Promise<ICamp> {
    const targetStatus = targetStatusInput?.toLowerCase().trim();

    if (!['draft', 'published', 'ongoing', 'in_progress', 'completed', 'cancelled'].includes(targetStatus)) {
      const err = new Error(`Invalid target status '${targetStatusInput}'.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    const camp = await this.getCampById(campId, callerHospitalId, isSystemAdmin);
    const currentStatus = camp.status;

    if (currentStatus === 'completed' || currentStatus === 'cancelled') {
      const err = new Error(`Cannot transition from terminal state '${currentStatus}'.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    if (currentStatus === targetStatus || (['ongoing', 'in_progress'].includes(currentStatus) && ['ongoing', 'in_progress'].includes(targetStatus))) {
      const err = new Error(`Camp is already in '${currentStatus}' status.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    if (currentStatus === 'draft') {
      if (targetStatus === 'published') {
        return this.publishCamp(campId, callerHospitalId, isSystemAdmin, context);
      }
      if (targetStatus === 'cancelled') {
        return this.cancelCamp(campId, reason || 'Cancelled from draft', callerHospitalId, isSystemAdmin, context);
      }
      const err = new Error(`Camp must be PUBLISHED before starting. Cannot transition directly from 'draft' to '${targetStatus}'.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    if (currentStatus === 'published') {
      if (targetStatus === 'ongoing' || targetStatus === 'in_progress') {
        return this.startCamp(campId, callerHospitalId, isSystemAdmin, context);
      }
      if (targetStatus === 'cancelled') {
        return this.cancelCamp(campId, reason || 'Cancelled after publishing', callerHospitalId, isSystemAdmin, context);
      }
      const err = new Error(`Invalid transition from 'published' to '${targetStatus}'. A published camp can only transition to ONGOING or CANCELLED.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    if (currentStatus === 'ongoing' || currentStatus === 'in_progress') {
      if (targetStatus === 'completed') {
        return this.completeCamp(campId, callerHospitalId, isSystemAdmin, context);
      }
      if (targetStatus === 'cancelled') {
        return this.cancelCamp(campId, reason || 'Cancelled while ongoing', callerHospitalId, isSystemAdmin, context);
      }
      const err = new Error(`Cannot transition from '${currentStatus}' to '${targetStatus}'. An active camp can only transition to COMPLETED or CANCELLED.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_TRANSITION';
      throw err;
    }

    const err = new Error(`Invalid camp transition from '${currentStatus}' to '${targetStatus}'.`);
    (err as any).statusCode = 400;
    (err as any).code = 'INVALID_CAMP_TRANSITION';
    throw err;
  }

  /**
   * Update camp details (allowed for draft or published camps)
   */
  static async updateCamp(
    campId: string,
    dto: Partial<CreateCampDto>,
    callerHospitalId: string | undefined,
    isSystemAdmin: boolean,
    context: CampAuditContext
  ): Promise<ICamp> {
    const camp = await this.getCampById(campId, callerHospitalId, isSystemAdmin);

    if (camp.status === 'completed' || camp.status === 'cancelled') {
      const err = new Error(`Cannot update a ${camp.status} camp.`);
      (err as any).statusCode = 400;
      (err as any).code = 'CAMP_IMMUTABLE';
      throw err;
    }

    if (dto.name) {
      validateClinicalWording(dto.name, 'Camp name');
      camp.name = dto.name;
    }
    if (dto.notes) {
      validateClinicalWording(dto.notes, 'Camp notes');
      camp.notes = dto.notes;
    }
    if (dto.location?.address) {
      validateClinicalWording(dto.location.address, 'Location address');
      camp.location.address = dto.location.address;
    }
    if (dto.location?.gpsCoordinates) {
      camp.location.gpsCoordinates = dto.location.gpsCoordinates;
    }
    if (dto.targetPopulation) {
      camp.targetPopulation = dto.targetPopulation;
    }

    const newStart = dto.startDate ? new Date(dto.startDate) : camp.startDate;
    const newEnd = dto.endDate ? new Date(dto.endDate) : camp.endDate;

    if (dto.startDate || dto.endDate) {
      if (newEnd < newStart) {
        const err = new Error('Camp end date must be on or after start date');
        (err as any).statusCode = 400;
        (err as any).code = 'INVALID_CAMP_DATES';
        throw err;
      }
      camp.startDate = newStart;
      camp.endDate = newEnd;
    }

    const newMo = dto.leadMoId || camp.leadMoId;
    const newWorkers = dto.assignedWorkerIds || camp.assignedWorkerIds;

    if (dto.startDate || dto.endDate || dto.leadMoId || dto.assignedWorkerIds) {
      await this.checkTeamAssignmentOverlap(
        newStart,
        newEnd,
        newMo,
        newWorkers,
        camp.campId
      );
    }

    if (dto.leadMoId) camp.leadMoId = dto.leadMoId;
    if (dto.leadMoName) camp.leadMoName = dto.leadMoName;
    if (dto.assignedWorkerIds) camp.assignedWorkerIds = Array.from(new Set(dto.assignedWorkerIds));

    await camp.save();

    await AuditLog.create({
      action: 'CAMP_UPDATE',
      actorId: context.actorId,
      actorRole: context.actorRole,
      resourceType: 'camp',
      resourceId: camp.campId,
      ip: context.ip,
      userAgent: context.userAgent,
      statusCode: 200,
      metadata: {
        event: 'camp.updated',
        hospitalId: camp.hospitalId,
        villageId: camp.villageId,
        status: camp.status,
      },
      simulation: true,
    });

    return camp;
  }

  /**
   * Delete a camp (only allowed for draft camps)
   */
  static async deleteCamp(
    campId: string,
    callerHospitalId: string | undefined,
    isSystemAdmin: boolean,
    context: CampAuditContext
  ): Promise<void> {
    const camp = await this.getCampById(campId, callerHospitalId, isSystemAdmin);

    if (camp.status !== 'draft') {
      const err = new Error(`Only DRAFT camps can be deleted. Current status is '${camp.status}'. Use cancel for published/ongoing camps.`);
      (err as any).statusCode = 400;
      (err as any).code = 'INVALID_CAMP_DELETION';
      throw err;
    }

    await Camp.deleteOne({ campId: camp.campId });

    await AuditLog.create({
      action: 'CAMP_DELETE',
      actorId: context.actorId,
      actorRole: context.actorRole,
      resourceType: 'camp',
      resourceId: camp.campId,
      ip: context.ip,
      userAgent: context.userAgent,
      statusCode: 200,
      metadata: {
        event: 'camp.deleted',
        hospitalId: camp.hospitalId,
        villageId: camp.villageId,
      },
      simulation: true,
    });
  }

  /**
   * Assign or update health workers for a camp
   */
  static async assignWorkers(
    campId: string,
    workerIds: string[],
    callerHospitalId: string | undefined,
    isSystemAdmin: boolean,
    context: CampAuditContext
  ): Promise<ICamp> {
    const camp = await this.getCampById(campId, callerHospitalId, isSystemAdmin);

    if (camp.status === 'completed' || camp.status === 'cancelled') {
      const err = new Error(`Cannot assign workers to a ${camp.status} camp.`);
      (err as any).statusCode = 400;
      (err as any).code = 'CAMP_IMMUTABLE';
      throw err;
    }

    const uniqueWorkerIds = Array.from(new Set(workerIds));

    // Check overlapping team assignments
    await this.checkTeamAssignmentOverlap(
      camp.startDate,
      camp.endDate,
      camp.leadMoId,
      uniqueWorkerIds,
      camp.campId
    );

    camp.assignedWorkerIds = uniqueWorkerIds;
    await camp.save();

    await AuditLog.create({
      action: 'CAMP_WORKERS_ASSIGN',
      actorId: context.actorId,
      actorRole: context.actorRole,
      resourceType: 'camp',
      resourceId: camp.campId,
      ip: context.ip,
      userAgent: context.userAgent,
      statusCode: 200,
      metadata: {
        hospitalId: camp.hospitalId,
        assignedCount: camp.assignedWorkerIds.length,
      },
      simulation: true,
    });

    return camp;
  }

  /**
   * Record a screening conducted at this camp
   */
  static async recordScreening(
    campId: string,
    data: { isAbnormal?: boolean; isReferred?: boolean },
    callerHospitalId?: string,
    isSystemAdmin: boolean = false
  ): Promise<ICamp> {
    const camp = await this.getCampById(campId, callerHospitalId, isSystemAdmin);

    if (camp.status !== 'in_progress' && camp.status !== 'ongoing') {
      const err = new Error(`Cannot record screenings for camp in '${camp.status}' status. Camp must be ONGOING.`);
      (err as any).statusCode = 400;
      (err as any).code = 'CAMP_NOT_ACTIVE';
      throw err;
    }

    camp.screeningCount = (camp.screeningCount || 0) + 1;
    if (data.isAbnormal) {
      camp.abnormalFindingsCount = (camp.abnormalFindingsCount || 0) + 1;
    }
    if (data.isReferred) {
      camp.referralsCount = (camp.referralsCount || 0) + 1;
    }

    await camp.save();
    return camp;
  }

  /**
   * Get camp statistics with Small-Count Cell Suppression (< 5) applied
   */
  static async getCampStatistics(
    campId: string,
    callerHospitalId?: string,
    isSystemAdmin: boolean = false,
    isHealthWorker: boolean = false,
    assignedVillages?: string[]
  ): Promise<CampStatisticsResult> {
    const camp = await this.getCampById(
      campId,
      callerHospitalId,
      isSystemAdmin,
      isHealthWorker,
      assignedVillages
    );

    return {
      campId: camp.campId,
      name: camp.name,
      hospitalId: camp.hospitalId,
      villageId: camp.villageId,
      status: camp.status,
      targetPopulation: camp.targetPopulation,
      metrics: {
        screeningsConducted: applySmallCountSuppression(camp.screeningCount || 0),
        abnormalLesionsFlagged: applySmallCountSuppression(camp.abnormalFindingsCount || 0),
        referralsInitiated: applySmallCountSuppression(camp.referralsCount || 0),
      },
      cellSuppressionThreshold: 5,
      privacyNotice: 'Small-count cell suppression applied (< 5) for tribal habitation privacy protection.',
      simulation: true,
    };
  }
}
