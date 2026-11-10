import { v4 as uuidv4 } from 'uuid';
import { VillageGroup, IVillageGroup, VillageGroupStatus } from './villageGroupModel.js';
import { Village } from '../reference/villageModel.js';
import { AuditLog } from '../audit/auditModel.js';
import { logger } from '../../config/logger.js';
import { PatientRegisteredEvent } from '../patient/patientEvents.js';

import {
  type SuppressedMetric,
  applySmallCountSuppression,
  SMALL_COUNT_SUPPRESSION_THRESHOLD,
  SUPPRESSION_NOTICE,
} from '../shared/aggregationUtils.js';

export {
  type SuppressedMetric,
  applySmallCountSuppression,
  SMALL_COUNT_SUPPRESSION_THRESHOLD,
  SUPPRESSION_NOTICE,
};

/**
 * Normalizes patient address text for clustering into a village group.
 * Combines villageId with cleaned address tokens to create a deterministic key.
 */
export function normalizeAddress(address: string, villageId: string): string {
  const cleaned = address
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${villageId.toUpperCase()}_${cleaned}`;
}

export class VillageGroupService {
  /**
   * Event listener handler called on patient registration.
   * Auto-clusters patient into an existing village group or creates a pending_approval group.
   */
  static async handlePatientRegistered(event: PatientRegisteredEvent): Promise<IVillageGroup | null> {
    if (!event.originalAddressText || !event.villageId) return null;

    // Check if auto-trigger is blocked for this village due to prior rejection
    const blockedGroup = await VillageGroup.findOne({
      villageId: event.villageId,
      autoTriggerBlocked: true,
    });

    if (blockedGroup) {
      logger.info({
        event: 'village_group_auto_trigger_skipped',
        villageId: event.villageId,
        reason: 'Auto-clustering blocked by previous admin rejection',
      });
      return null;
    }

    const normalized = normalizeAddress(event.originalAddressText, event.villageId);

    // Look for existing active, pending_approval, or inactive group
    let group = await VillageGroup.findOne({
      normalizedAddress: normalized,
      status: { $in: ['pending_approval', 'active', 'inactive'] },
    });

    if (group) {
      // Add patient if not already in member list
      if (!group.memberPatientIds.includes(event.patientId)) {
        group.memberPatientIds.push(event.patientId);
        group.patientCount = group.memberPatientIds.length;
        await group.save();
      }
      return group;
    }

    // Lookup village name from reference table if missing
    let villageName = event.villageId;
    try {
      const vDoc = await Village.findOne({ villageId: event.villageId });
      if (vDoc) villageName = vDoc.villageName;
    } catch {
      // fallback
    }

    // Auto-create new pending_approval group
    try {
      const groupId = `vg_${uuidv4().substring(0, 8)}`;
      group = await VillageGroup.create({
        groupId,
        groupName: `${villageName} - Habitation Cluster`,
        villageId: event.villageId,
        villageName,
        mandal: event.mandal,
        normalizedAddress: normalized,
        sampleAddressText: event.originalAddressText,
        memberPatientIds: [event.patientId],
        patientCount: 1,
        status: 'pending_approval',
        autoCreated: true,
        autoTriggerBlocked: false,
        simulation: true,
      });

      logger.info({
        event: 'village_group_auto_created',
        groupId: group.groupId,
        villageId: group.villageId,
      });

      return group;
    } catch (err: any) {
      // Handle race condition: duplicate key error 11000
      if (err.code === 11000) {
        const raceGroup = await VillageGroup.findOne({
          normalizedAddress: normalized,
          status: { $in: ['pending_approval', 'active', 'inactive'] },
        });
        if (raceGroup && !raceGroup.memberPatientIds.includes(event.patientId)) {
          raceGroup.memberPatientIds.push(event.patientId);
          raceGroup.patientCount = raceGroup.memberPatientIds.length;
          await raceGroup.save();
          return raceGroup;
        }
      }
      throw err;
    }
  }

  /**
   * Lists village groups with filters
   */
  static async listVillageGroups(filter: any = {}): Promise<IVillageGroup[]> {
    const query: any = { ...filter };
    return VillageGroup.find(query).sort({ createdAt: -1 });
  }

  /**
   * Fetches single village group by ID
   */
  static async getVillageGroupById(groupId: string): Promise<IVillageGroup | null> {
    return VillageGroup.findOne({ groupId });
  }

  /**
   * Admin approves a pending village group
   */
  static async approveVillageGroup(groupId: string, actorId: string): Promise<IVillageGroup> {
    const group = await VillageGroup.findOne({ groupId });
    if (!group) {
      const err: any = new Error('Village group not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    group.status = 'active';
    group.approvedBy = actorId;
    group.approvedAt = new Date();
    await group.save();

    await AuditLog.create({
      action: 'VILLAGE_GROUP_APPROVED',
      resourceType: 'village_group',
      resourceId: groupId,
      actorId,
      actorRole: 'admin',
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: { groupId, status: 'active' },
      simulation: true,
    });

    return group;
  }

  /**
   * Admin rejects a village group (sets autoTriggerBlocked: true)
   */
  static async rejectVillageGroup(groupId: string, actorId: string, reason?: string): Promise<IVillageGroup> {
    const group = await VillageGroup.findOne({ groupId });
    if (!group) {
      const err: any = new Error('Village group not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    group.status = 'rejected';
    group.rejectedBy = actorId;
    group.rejectedAt = new Date();
    group.rejectionReason = reason;
    group.autoTriggerBlocked = true;
    await group.save();

    await AuditLog.create({
      action: 'VILLAGE_GROUP_REJECTED',
      resourceType: 'village_group',
      resourceId: groupId,
      actorId,
      actorRole: 'admin',
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: { groupId, status: 'rejected', autoTriggerBlocked: true, rejectionReason: reason },
      simulation: true,
    });

    return group;
  }

  /**
   * Admin unblocks auto-trigger for a village
   */
  static async unblockVillageAutoTrigger(groupId: string, actorId: string): Promise<IVillageGroup> {
    const group = await VillageGroup.findOne({ groupId });
    if (!group) {
      const err: any = new Error('Village group not found');
      err.code = 'NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    group.autoTriggerBlocked = false;
    group.unblockedBy = actorId;
    group.unblockedAt = new Date();
    await group.save();

    await AuditLog.create({
      action: 'VILLAGE_GROUP_AUTO_TRIGGER_UNBLOCKED',
      resourceType: 'village_group',
      resourceId: groupId,
      actorId,
      actorRole: 'admin',
      ip: '127.0.0.1',
      statusCode: 200,
      metadata: { groupId, autoTriggerBlocked: false },
      simulation: true,
    });

    return group;
  }

  /**
   * Explicitly triggers clustering detection
   */
  static async triggerClusteringForVillage(villageId: string, actorId: string) {
    return {
      triggered: true,
      villageId,
      actorId,
      message: `Clustering detection triggered for village ${villageId}`,
      simulation: true,
    };
  }

  /**
   * Computes small-count cell suppressed aggregates (< 5)
   */
  static async getSuppressedAggregates(mandalFilter?: string) {
    const query: any = {};
    if (mandalFilter) query.mandal = mandalFilter;

    const groups = await VillageGroup.find(query);

    const totalGroups = groups.length;
    const activeGroups = groups.filter((g) => g.status === 'active').length;
    const pendingApproval = groups.filter((g) => g.status === 'pending_approval').length;

    // Unique patients across groups
    const allPatientSet = new Set<string>();
    groups.forEach((g) => {
      g.memberPatientIds.forEach((pid: string) => allPatientSet.add(pid));
    });

    // Breakdown per village
    const villageMap = new Map<string, { villageId: string; villageName: string; mandal: string; groupCount: number; patientSet: Set<string> }>();
    const mandalMap = new Map<string, { mandal: string; groupCount: number; patientSet: Set<string> }>();

    for (const g of groups) {
      if (!villageMap.has(g.villageId)) {
        villageMap.set(g.villageId, {
          villageId: g.villageId,
          villageName: g.villageName,
          mandal: g.mandal,
          groupCount: 0,
          patientSet: new Set<string>(),
        });
      }
      const vEntry = villageMap.get(g.villageId)!;
      vEntry.groupCount += 1;
      g.memberPatientIds.forEach((pid: string) => vEntry.patientSet.add(pid));

      if (!mandalMap.has(g.mandal)) {
        mandalMap.set(g.mandal, {
          mandal: g.mandal,
          groupCount: 0,
          patientSet: new Set<string>(),
        });
      }
      const mEntry = mandalMap.get(g.mandal)!;
      mEntry.groupCount += 1;
      g.memberPatientIds.forEach((pid: string) => mEntry.patientSet.add(pid));
    }

    const villageBreakdown = Array.from(villageMap.values()).map((v) => ({
      villageId: v.villageId,
      villageName: v.villageName,
      mandal: v.mandal,
      groupCount: v.groupCount,
      patientCount: applySmallCountSuppression(v.patientSet.size),
    }));

    const mandalBreakdown = Array.from(mandalMap.values()).map((m) => ({
      mandal: m.mandal,
      groupCount: m.groupCount,
      patientCount: applySmallCountSuppression(m.patientSet.size),
    }));

    return {
      summary: {
        totalGroups,
        activeGroups,
        pendingApproval,
        totalPatients: applySmallCountSuppression(allPatientSet.size),
      },
      villageBreakdown,
      mandalBreakdown,
      notice: SUPPRESSION_NOTICE,
      simulation: true,
    };
  }
}
