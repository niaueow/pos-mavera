import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import jwt from 'jsonwebtoken';

const VALID_STAFF_EMAIL = process.env.INITIAL_STAFF_EMAIL || 'staff@mavera.local';
const VALID_STAFF_PASSWORD = process.env.INITIAL_STAFF_PASSWORD || 'StaffMavera123!';
const VALID_ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL || 'admin@mavera.local';
const VALID_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'AdminMavera123!';

describe('Authentication & Authorization', () => {
  let app: Application;
  let staffToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = createApp();

    // Login staff to get a valid token
    const staffRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_STAFF_EMAIL, password: VALID_STAFF_PASSWORD });

    if (staffRes.status === 200) {
      staffToken = staffRes.body.data.access_token;
    }

    // Login admin to get a valid token
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_ADMIN_EMAIL, password: VALID_ADMIN_PASSWORD });

    if (adminRes.status === 200) {
      adminToken = adminRes.body.data.access_token;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ─── POST /api/v1/auth/login ──────────────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {
    it('should return 200 and access_token for valid staff credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: VALID_STAFF_EMAIL, password: VALID_STAFF_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.access_token).toBeTruthy();
      expect(res.body.data.token_type).toBe('Bearer');
      expect(res.body.data.user.email).toBe(VALID_STAFF_EMAIL);
      expect(res.body.data.user.role).toBe('STAFF');

      // Must not leak password hash
      expect(res.body.data.user.password_hash).toBeUndefined();
      expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('should return 200 and access_token for valid admin credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: VALID_ADMIN_EMAIL, password: VALID_ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('ADMIN');
    });

    it('should return 401 for invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: VALID_STAFF_EMAIL, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      // Must not reveal if the email was found or not (prevent enumeration)
      expect(res.body.error.message).toMatch(/Email atau kata sandi tidak valid/);
    });

    it('should return 401 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@mavera.invalid', password: 'Anything1!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 422 for missing email or invalid format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'Pass1234!' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 for missing password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: VALID_STAFF_EMAIL });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /api/v1/auth/me ─────────────────────────────────────────────────
  describe('GET /api/v1/auth/me', () => {
    it('should return 200 and current user for valid Bearer token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(VALID_STAFF_EMAIL);
      expect(res.body.data.role).toBe('STAFF');
      expect(res.body.data.password_hash).toBeUndefined();
    });

    it('should return 401 when no Authorization header is provided', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 for a malformed token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer this.is.not.a.valid.jwt');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should return 401 for an expired token', async () => {
      // Create a token that expired 1 second in the past
      const jwtSecret = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production_min_32_characters_long';
      const expiredToken = jwt.sign(
        { id: 999, email: 'test@test.com', name: 'Test', role: 'STAFF' },
        jwtSecret,
        { expiresIn: -1 }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });

  // ─── GET /api/v1/internal/orders ─────────────────────────────────────────
  describe('GET /api/v1/internal/orders', () => {
    it('should return 401 with no authentication', async () => {
      const res = await request(app).get('/api/v1/internal/orders');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 for authenticated STAFF', async () => {
      const res = await request(app)
        .get('/api/v1/internal/orders')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 200 for authenticated ADMIN', async () => {
      const res = await request(app)
        .get('/api/v1/internal/orders')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── PATCH /api/v1/internal/orders/:order_id/status ─────────────────────
  describe('PATCH /api/v1/internal/orders/:order_id/status', () => {
    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app)
        .patch('/api/v1/internal/orders/1/status')
        .send({ status: 'PREPARING' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent order', async () => {
      const res = await request(app)
        .patch('/api/v1/internal/orders/999999/status')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'PREPARING' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 422 for invalid status value', async () => {
      const res = await request(app)
        .patch('/api/v1/internal/orders/1/status')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'INVALID_STATUS' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 for invalid order_id parameter', async () => {
      const res = await request(app)
        .patch('/api/v1/internal/orders/not-a-number/status')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'PREPARING' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── Public endpoints must remain accessible ──────────────────────────────
  describe('Public endpoints should NOT require authentication', () => {
    it('GET /api/v1/menus should return 200 without auth token', async () => {
      const res = await request(app).get('/api/v1/menus');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/v1/health should return 200 without auth token', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
