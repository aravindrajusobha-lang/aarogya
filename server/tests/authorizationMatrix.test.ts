import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import {
  ALL_ROLES,
  ENDPOINT_CAPABILITY_TABLE,
  ROLE_CAPABILITY_MATRIX,
  verifyAllExpressRoutesCovered,
} from '../src/modules/auth/authorizationEngine.js';
import { UserRole } from '../src/modules/auth/userModel.js';
import { signAccessToken } from '../src/modules/auth/tokenService.js';
import { createTestReplicaSet } from './setupReplSet.js';

describe('Central Authorization Engine: Full Matrix & CI Route Coverage', () => {
  let replSet: MongoMemoryReplSet;
  const app = createApp();
  const roleTokens: Record<UserRole, string> = {} as any;

  beforeAll(async () => {
    replSet = await createTestReplicaSet('rsMatrix');
    await mongoose.connect(replSet.getUri());

    // Generate valid signed tokens for all 6 roles
    for (const role of ALL_ROLES) {
      roleTokens[role] = signAccessToken({
        userId: `matrix_user_${role}`,
        role,
        scopes: ROLE_CAPABILITY_MATRIX[role] || [],
        deviceSessionId: `ses_matrix_${role}`,
        deviceId: `dev_matrix_${role}`,
      });
    }
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  it('fails CI if any mounted route in Express is missing from the capability table', () => {
    const coverage = verifyAllExpressRoutesCovered(app);

    expect(coverage.missingRoutes, `Unregistered routes detected: ${coverage.missingRoutes.join(', ')}`).toEqual([]);
    expect(coverage.coveredRoutes).toBe(coverage.totalRoutes);
    expect(coverage.coveredRoutes).toBeGreaterThan(0);
  });

  it('strictly verifies NO forgot-password or reset-password endpoints exist (Recovery in Phase 6)', async () => {
    const forgotRes = await request(app).post('/api/v1/auth/forgot-password');
    expect(forgotRes.status).toBe(404);

    const resetRes = await request(app).post('/api/v1/auth/reset-password');
    expect(resetRes.status).toBe(404);
  });

  it('verifies System Admin role has universal capability access (*)', () => {
    expect(ROLE_CAPABILITY_MATRIX['system_admin']).toEqual(['*']);
    expect(ALL_ROLES).toContain('system_admin');
  });

  // Programmatic testing of Every Role against Every Endpoint in the Capability Matrix
  describe('Capability Matrix Evaluation: Every Role Against Every Endpoint', () => {
    for (const endpoint of ENDPOINT_CAPABILITY_TABLE) {
      if (endpoint.requiredCapability === 'public') {
        continue;
      }

      describe(`${endpoint.method} ${endpoint.path} [Requires: ${endpoint.requiredCapability}]`, () => {
        for (const role of ALL_ROLES) {
          const isAllowed =
            role === 'system_admin' ||
            (ROLE_CAPABILITY_MATRIX[role] &&
              (ROLE_CAPABILITY_MATRIX[role].includes('*') ||
                ROLE_CAPABILITY_MATRIX[role].includes(endpoint.requiredCapability)));

          it(`Role "${role}": ${isAllowed ? 'ALLOWED (not 403)' : 'FORBIDDEN (403)'}`, async () => {
            const token = roleTokens[role];

            // Build realistic request path with dummy parameter replacements
            const testPath = endpoint.path
              .replace(':fileId', '00000000-0000-0000-0000-000000000000')
              .replace(':deviceId', 'dev_mock_test')
              .replace(':patientId', role === 'patient' ? `matrix_user_${role}` : 'PAT-MOCK-001')
              .replace(':hospitalId', 'hosp_test_dh')
              .replace(':token', 'mock_token_hex_1234567890')
              .replace(':workerId', role === 'asha' || role === 'anm' ? `matrix_user_${role}` : 'usr_mock_worker')
              .replace(':id', 'mock_id_123');

            let reqBuilder: request.Test;
            if (endpoint.method === 'GET') {
              reqBuilder = request(app).get(testPath);
            } else if (endpoint.method === 'POST') {
              reqBuilder = request(app).post(testPath);
            } else if (endpoint.method === 'PUT') {
              reqBuilder = request(app).put(testPath);
            } else if (endpoint.method === 'DELETE') {
              reqBuilder = request(app).delete(testPath);
            } else {
              reqBuilder = request(app).get(testPath);
            }

            const res = await reqBuilder.set('Authorization', `Bearer ${token}`);

            if (isAllowed) {
              // Access granted: status should NOT be 403
              expect(res.status).not.toBe(403);
            } else {
              // Access denied: status MUST be 403 Forbidden
              expect(res.status).toBe(403);
              expect(res.body.error?.code).toBe('FORBIDDEN');
            }
          });
        }
      });
    }
  });
});
