import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { VillageGroup } from '../src/modules/villageGroup/villageGroupModel.js';
import { VillageGroupService, normalizeAddress, applySmallCountSuppression } from '../src/modules/villageGroup/villageGroupService.js';
import { User } from '../src/modules/auth/userModel.js';
import { AuditLog } from '../src/modules/audit/auditModel.js';
import { HealthWorkerAssignment } from '../src/modules/assignment/assignmentModel.js';
import { hashPassword, signAccessToken } from '../src/modules/auth/tokenService.js';
import { getRoleCapabilities } from '../src/modules/auth/authorizationEngine.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Phase 7: Village Groups (v0.2 “Village Group Management”) & Small-Count Suppression', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();

  let adminToken: string;
  let adminUserId = 'usr_admin_village_grp';

  let ashaToken: string;
  let ashaUserId = 'usr_asha_village_grp';

  const testVillageId = 'VILLAGE_ARAKU_01';
  const testMandal = 'Araku Valley';
  const testAddress = 'Main Tribal Street, Near Community Well, Habitation A';

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsVillageGroups');
    await mongoose.connect(replSet.getUri());

    // Explicitly build schema indexes including partial unique index
    await VillageGroup.init();

    const pwd = await hashPassword('AdminPass@2026');

    // 1. Create Admin User
    await User.create({
      userId: adminUserId,
      username: 'admin.village',
      role: 'admin',
      fullName: 'Tribal Village Admin Officer',
      hospitalId: 'hosp_araku_chc',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    const adminCaps = await getRoleCapabilities('admin');
    adminToken = signAccessToken({
      userId: adminUserId,
      role: 'admin',
      scopes: adminCaps,
      deviceSessionId: 'ses_admin_vg_01',
      deviceId: 'dev_admin_vg_01',
    });

    // 2. Create ASHA User
    await User.create({
      userId: ashaUserId,
      username: 'asha.village',
      role: 'asha',
      fullName: 'Tribal ASHA Worker',
      hospitalId: 'hosp_araku_chc',
      passwordHash: pwd,
      status: 'active',
      simulation: true,
    });

    const ashaCaps = await getRoleCapabilities('asha');
    ashaToken = signAccessToken({
      userId: ashaUserId,
      role: 'asha',
      scopes: ashaCaps,
      deviceSessionId: 'ses_asha_vg_01',
      deviceId: 'dev_asha_vg_01',
    });

    // 3. Assign ASHA to testVillageId
    await HealthWorkerAssignment.create({
      assignmentId: 'asg_vg_test_01',
      workerId: ashaUserId,
      workerName: 'Tribal ASHA Worker',
      workerRole: 'asha',
      hospitalId: 'hosp_araku_chc',
      assignedMandal: testMandal,
      assignedVillages: [testVillageId, 'VILLAGE_PADERU_02'],
      assignedBy: adminUserId,
      status: 'active',
      simulation: true,
    });

  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  describe('1. Two simultaneous registrations from one village create exactly one group', () => {
    it('creates exactly one group when two concurrent registrations from the same village address arrive', async () => {
      // Fire two simultaneous patient registrations concurrently
      const payload1 = {
        fullName: 'Lakshmi Somu',
        gender: 'female',
        ageEstimated: 29,
        villageId: testVillageId,
        villageName: 'Araku Central',
        mandal: testMandal,
        originalAddressText: testAddress,
        hospitalId: 'hosp_araku_chc',
      };

      const payload2 = {
        fullName: 'Ramu Somu',
        gender: 'male',
        ageEstimated: 34,
        villageId: testVillageId,
        villageName: 'Araku Central',
        mandal: testMandal,
        originalAddressText: testAddress,
        hospitalId: 'hosp_araku_chc',
      };

      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/patients')
          .set('Authorization', `Bearer ${ashaToken}`)
          .send(payload1),
        request(app)
          .post('/api/v1/patients')
          .set('Authorization', `Bearer ${ashaToken}`)
          .send(payload2),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const patientId1 = res1.body.data.patient.patientId;
      const patientId2 = res2.body.data.patient.patientId;
      expect(patientId1).toBeTruthy();
      expect(patientId2).toBeTruthy();
      expect(patientId1).not.toBe(patientId2);


      // Verify that in the database, exactly ONE VillageGroup exists for this normalized address
      const normalized = normalizeAddress(testAddress, testVillageId);
      const groups = await VillageGroup.find({ normalizedAddress: normalized });

      expect(groups.length).toBe(1);
      const group = groups[0];
      expect(group.normalizedAddress).toBe(normalized);
      expect(group.villageId).toBe(testVillageId);
      expect(group.autoCreated).toBe(true);
      expect(group.status).toBe('pending_approval');

      // Verify both patients were attached to this single group
      expect(group.memberPatientIds).toContain(patientId1);
      expect(group.memberPatientIds).toContain(patientId2);
      expect(group.patientCount).toBe(2);
    });
  });

  describe('2. Partial Unique Index: Inactive groups block duplicates; rejected or deleted groups do not', () => {
    it('verifies an inactive group still blocks duplicate creation with same address', async () => {
      const uniqueAddress = 'Inactive Street, Habitation B';
      const normalizedInactive = normalizeAddress(uniqueAddress, 'VILLAGE_PADERU_02');

      // Create an inactive group
      await VillageGroup.create({
        groupId: 'vg_inactive_test_01',
        groupName: 'Inactive Habitation Group',
        villageId: 'VILLAGE_PADERU_02',
        villageName: 'Paderu East',
        mandal: 'Paderu',
        normalizedAddress: normalizedInactive,
        sampleAddressText: uniqueAddress,
        memberPatientIds: ['pat_001'],
        patientCount: 1,
        status: 'inactive', // Inactive is included in partialFilterExpression!
        autoCreated: false,
        autoTriggerBlocked: false,
        simulation: true,
      });

      // Attempt to create another group with the same normalizedAddress and status 'active' or 'pending_approval'
      let duplicateError: any = null;
      try {
        await VillageGroup.create({
          groupId: 'vg_inactive_duplicate_02',
          groupName: 'Duplicate Attempt Group',
          villageId: 'VILLAGE_PADERU_02',
          villageName: 'Paderu East',
          mandal: 'Paderu',
          normalizedAddress: normalizedInactive,
          sampleAddressText: uniqueAddress,
          memberPatientIds: ['pat_002'],
          patientCount: 1,
          status: 'pending_approval',
          autoCreated: false,
          autoTriggerBlocked: false,
          simulation: true,
        });
      } catch (err: any) {
        duplicateError = err;
      }

      // Must fail with MongoDB duplicate key error (code 11000)
      expect(duplicateError).toBeTruthy();
      expect(duplicateError.code).toBe(11000);
    });

    it('verifies a rejected or deleted group does NOT block a new group from being created', async () => {
      const uniqueAddress2 = 'Hillside Colony, Habitation C';
      const normalizedRejected = normalizeAddress(uniqueAddress2, 'VILLAGE_PADERU_02');

      // 1. Create a rejected group
      await VillageGroup.create({
        groupId: 'vg_rejected_test_01',
        groupName: 'Rejected Group',
        villageId: 'VILLAGE_PADERU_02',
        villageName: 'Paderu East',
        mandal: 'Paderu',
        normalizedAddress: normalizedRejected,
        sampleAddressText: uniqueAddress2,
        memberPatientIds: ['pat_003'],
        patientCount: 1,
        status: 'rejected', // Excluded from partial unique index
        autoCreated: false,
        autoTriggerBlocked: false,
        simulation: true,
      });

      // 2. Create a new pending_approval group with the same address - must succeed!
      const newGroupAfterRejection = await VillageGroup.create({
        groupId: 'vg_after_rejection_02',
        groupName: 'New Fresh Group After Rejection',
        villageId: 'VILLAGE_PADERU_02',
        villageName: 'Paderu East',
        mandal: 'Paderu',
        normalizedAddress: normalizedRejected,
        sampleAddressText: uniqueAddress2,
        memberPatientIds: ['pat_004'],
        patientCount: 1,
        status: 'pending_approval',
        autoCreated: false,
        autoTriggerBlocked: false,
        simulation: true,
      });

      expect(newGroupAfterRejection.groupId).toBe('vg_after_rejection_02');

      // 3. Mark the new group as deleted
      newGroupAfterRejection.status = 'deleted';
      await newGroupAfterRejection.save();

      // 4. Create another group with same address after deletion - must succeed!
      const newGroupAfterDeletion = await VillageGroup.create({
        groupId: 'vg_after_deletion_03',
        groupName: 'New Fresh Group After Deletion',
        villageId: 'VILLAGE_PADERU_02',
        villageName: 'Paderu East',
        mandal: 'Paderu',
        normalizedAddress: normalizedRejected,
        sampleAddressText: uniqueAddress2,
        memberPatientIds: ['pat_005'],
        patientCount: 1,
        status: 'active',
        autoCreated: false,
        autoTriggerBlocked: false,
        simulation: true,
      });

      expect(newGroupAfterDeletion.groupId).toBe('vg_after_deletion_03');
    });
  });

  describe('3. Admin approve, reject, and rejected group does not re-trigger until admin acts', () => {
    let testAutoGroupId: string;
    const rejectionVillageId = 'VILLAGE_ANANTHAGIRI_09';
    const rejectionAddress = 'Post Office Road, Habitation K';

    it('auto-creates group on registration and allows admin to reject it with a reason', async () => {
      // Register initial patient to auto-create group
      const regRes = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Chanti Kondababu',
          gender: 'male',
          ageEstimated: 41,
          villageId: rejectionVillageId,
          villageName: 'Ananthagiri Village',
          mandal: 'Ananthagiri',
          originalAddressText: rejectionAddress,
          hospitalId: 'hosp_araku_chc',
        });

      expect(regRes.status).toBe(201);

      // Find the auto-created group
      const normalized = normalizeAddress(rejectionAddress, rejectionVillageId);
      const group = await VillageGroup.findOne({ normalizedAddress: normalized });
      expect(group).toBeTruthy();
      expect(group!.status).toBe('pending_approval');
      testAutoGroupId = group!.groupId;

      // Non-admin (ASHA) attempting to reject or approve is blocked (403)
      const ashaReject = await request(app)
        .post(`/api/v1/village-groups/${testAutoGroupId}/reject`)
        .set('Authorization', `Bearer ${ashaToken}`)
        .send({ rejectionReason: 'Unauthorized attempt' });
      expect(ashaReject.status).toBe(403);

      // Admin rejects the village group
      const adminReject = await request(app)
        .post(`/api/v1/village-groups/${testAutoGroupId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rejectionReason: 'Incorrect habitation address grouping' });

      expect(adminReject.status).toBe(200);
      expect(adminReject.body.data.status).toBe('rejected');
      expect(adminReject.body.data.autoTriggerBlocked).toBe(true);
      expect(adminReject.body.data.rejectionReason).toBe('Incorrect habitation address grouping');

      // Verify audit trail logged
      const auditEntry = await AuditLog.findOne({
        action: 'VILLAGE_GROUP_REJECTED',
        resourceId: testAutoGroupId,
      });
      expect(auditEntry).toBeTruthy();
      expect(auditEntry!.metadata.autoTriggerBlocked).toBe(true);
    });

    it('guarantees a village with a rejected auto-group does NOT re-trigger automatic group creation', async () => {
      // Register a second patient in the same village with rejected auto-group
      const secondRegRes = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Appalaraju K',
          gender: 'male',
          ageEstimated: 49,
          villageId: rejectionVillageId,
          villageName: 'Ananthagiri Village',
          mandal: 'Ananthagiri',
          originalAddressText: 'Different Street in Same Village',
          hospitalId: 'hosp_araku_chc',
        });

      expect(secondRegRes.status).toBe(201);

      // Verify NO new group was created for this village!
      const allGroupsForVillage = await VillageGroup.find({ villageId: rejectionVillageId });
      // Only the previously rejected group should exist
      expect(allGroupsForVillage.length).toBe(1);
      expect(allGroupsForVillage[0].groupId).toBe(testAutoGroupId);
      expect(allGroupsForVillage[0].status).toBe('rejected');
    });

    it('re-enables auto-trigger once an admin explicitly acts to unblock the village', async () => {
      // Admin calls unblock-auto endpoint
      const unblockRes = await request(app)
        .post(`/api/v1/village-groups/${testAutoGroupId}/unblock-auto`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(unblockRes.status).toBe(200);
      expect(unblockRes.body.data.autoTriggerBlocked).toBe(false);

      // Register another patient in the same village
      const thirdRegRes = await request(app)
        .post('/api/v1/patients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fullName: 'Gangi Reddi',
          gender: 'female',
          ageEstimated: 38,
          villageId: rejectionVillageId,
          villageName: 'Ananthagiri Village',
          mandal: 'Ananthagiri',
          originalAddressText: 'Fresh Unblocked Street, Habitation New',
          hospitalId: 'hosp_araku_chc',
        });

      expect(thirdRegRes.status).toBe(201);

      // Now a new group should have been created!
      const groupsAfterUnblock = await VillageGroup.find({ villageId: rejectionVillageId });
      expect(groupsAfterUnblock.length).toBe(2);

      const newGroup = groupsAfterUnblock.find((g) => g.groupId !== testAutoGroupId);
      expect(newGroup).toBeTruthy();
      expect(newGroup!.status).toBe('pending_approval');
      expect(newGroup!.autoTriggerBlocked).toBe(false);

      // Admin approves the new group
      const approveRes = await request(app)
        .post(`/api/v1/village-groups/${newGroup!.groupId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.data.status).toBe('active');
    });
  });

  describe('4. Small-count cell suppression in any aggregate (< 5)', () => {
    it('applies small-count cell suppression for counts < 5 and reports "< 5"', async () => {
      // 1. Direct unit test of applySmallCountSuppression helper
      const zeroResult = applySmallCountSuppression(0);
      expect(zeroResult).toEqual({
        count: 0,
        displayValue: '0',
        isSuppressed: false,
      });

      const count1Result = applySmallCountSuppression(1);
      expect(count1Result.isSuppressed).toBe(true);
      expect(count1Result.displayValue).toBe('< 5');
      expect(count1Result.count).toBeNull();

      const count4Result = applySmallCountSuppression(4);
      expect(count4Result.isSuppressed).toBe(true);
      expect(count4Result.displayValue).toBe('< 5');
      expect(count4Result.count).toBeNull();

      const count5Result = applySmallCountSuppression(5);
      expect(count5Result.isSuppressed).toBe(false);
      expect(count5Result.displayValue).toBe('5');
      expect(count5Result.count).toBe(5);

      const count12Result = applySmallCountSuppression(12);
      expect(count12Result.isSuppressed).toBe(false);
      expect(count12Result.displayValue).toBe('12');
      expect(count12Result.count).toBe(12);
    });

    it('verifies GET /api/v1/village-groups/aggregates suppresses small counts (< 5)', async () => {
      // In our test database so far:
      // testVillageId has 2 patients (Lakshmi Somu, Ramu Somu).
      // rejectionVillageId has 3 patients.
      // Both village counts are < 5, so both should have isSuppressed === true and displayValue === "< 5"!
      const aggRes = await request(app)
        .get('/api/v1/village-groups/aggregates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(aggRes.status).toBe(200);
      const data = aggRes.body.data;

      expect(data.summary.totalGroups).toBeGreaterThanOrEqual(1);

      // Check village breakdown for testVillageId
      const testVillageAgg = data.villageBreakdown.find((v: any) => v.villageId === testVillageId);
      expect(testVillageAgg).toBeTruthy();
      expect(testVillageAgg.patientCount.isSuppressed).toBe(true);
      expect(testVillageAgg.patientCount.displayValue).toBe('< 5');
      expect(testVillageAgg.patientCount.count).toBeNull();
    });

    it('unsuppresses counts when patient count reaches 5 or more', async () => {
      // Add 3 more patients to testVillageId so total count reaches 5
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/api/v1/patients')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            fullName: `Habitation Member ${i}`,
            gender: 'female',
            ageEstimated: 25 + i,
            villageId: testVillageId,
            villageName: 'Araku Central',
            mandal: testMandal,
            originalAddressText: testAddress, // Matches same group
            hospitalId: 'hosp_araku_chc',
          });
      }

      // Query aggregates again
      const aggRes = await request(app)
        .get('/api/v1/village-groups/aggregates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(aggRes.status).toBe(200);
      const data = aggRes.body.data;

      const testVillageAgg = data.villageBreakdown.find((v: any) => v.villageId === testVillageId);
      expect(testVillageAgg).toBeTruthy();
      expect(testVillageAgg.patientCount.isSuppressed).toBe(false);
      expect(testVillageAgg.patientCount.count).toBe(5);
      expect(testVillageAgg.patientCount.displayValue).toBe('5');
    });
  });
});
