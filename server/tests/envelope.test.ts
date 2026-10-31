import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('Standard API Response Envelope Verification', () => {
  const app = createApp();

  it('guarantees standard envelope on success route /api/v1/health', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
    expect(res.body).toHaveProperty('meta');

    // Verify Meta Structure
    const meta = res.body.meta;
    expect(meta.simulation).toBe(true);
    expect(typeof meta.requestId).toBe('string');
    expect(typeof meta.timestamp).toBe('string');
    expect(meta.environment).toBeDefined();

    // Verify Header
    expect(res.headers['x-request-id']).toBe(meta.requestId);
  });

  it('guarantees standard envelope with mock indicators on simulation route', async () => {
    const res = await request(app).get('/api/v1/health/simulation');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(res.body.meta.simulation).toBe(true);
    expect(res.body.meta.is_mock).toBe(true);
    expect(res.body.meta.adapter_status).toBe('MOCK');
    expect(res.body.data.adapters.aiScreeningInference.type).toBe('DEMO AI');
  });

  it('guarantees standard envelope on 404 not found route', async () => {
    const res = await request(app).get('/api/v1/non_existent_route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.meta.simulation).toBe(true);
    expect(typeof res.body.meta.requestId).toBe('string');
  });

  it('guarantees standard envelope on invalid UUID parameter', async () => {
    const res = await request(app)
      .get('/api/v1/storage/files/invalid-uuid-string')
      .set('Authorization', 'Bearer sim_user_asha_123');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.data).toBeNull();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.meta.simulation).toBe(true);
  });
});
