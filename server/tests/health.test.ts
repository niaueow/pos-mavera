import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { Application } from 'express';

describe('Backend Foundation & Health Endpoints', () => {
  let app: Application;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://postgres:test@localhost:5432/pos_mavera?schema=public';
    process.env.JWT_SECRET = 'test_jwt_secret_min_16_characters_long';
    app = createApp();
  });

  it('GET /health should return 200 and standard success envelope', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('POS Mavera API is healthy');
    expect(res.body.data.status).toBe('UP');
    expect(res.body.data.environment).toBe('test');
    expect(res.body.data.timestamp).toBeDefined();
  });

  it('GET /api/v1/health should return 200 and match API specification envelope', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('UP');
  });

  it('GET /api/v1/non-existent-route should return 404 with standard error envelope', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('Route GET /api/v1/non-existent-route not found');
  });
});
