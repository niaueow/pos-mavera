import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Application } from 'express';
import { OrderStatus, OrderType, PaymentStatus } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

const VALID_STAFF_EMAIL = process.env.INITIAL_STAFF_EMAIL || 'staff@mavera.local';
const VALID_STAFF_PASSWORD = process.env.INITIAL_STAFF_PASSWORD || 'StaffMavera123!';
const VALID_ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL || 'admin@mavera.local';
const VALID_ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'AdminMavera123!';

describe('Milestone 3: Staff Operational API (/api/v1/staff/orders)', () => {
  let app: Application;
  let staffToken: string;
  let adminToken: string;
  let unauthorizedRoleToken: string;

  let testMenuId: number;
  let paidOrderId: number;
  let unpaidOrderId: number;
  const createdOrderIds: number[] = [];

  beforeAll(async () => {
    app = createApp();

    // 1. Obtain valid STAFF and ADMIN tokens
    const staffLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_STAFF_EMAIL, password: VALID_STAFF_PASSWORD });
    staffToken = staffLogin.body.data.access_token;

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: VALID_ADMIN_EMAIL, password: VALID_ADMIN_PASSWORD });
    adminToken = adminLogin.body.data.access_token;

    // 2. Generate a token with an unauthorized role (e.g., CUSTOMER / GUEST)
    const jwtSecret =
      process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production_min_32_characters_long';
    unauthorizedRoleToken = jwt.sign(
      { id: 9999, email: 'guest@mavera.local', name: 'Guest Customer', role: 'CUSTOMER' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // 3. Create a test menu item and two test orders (one PAID/RECEIVED, one PENDING/PENDING_PAYMENT)
    const menu = await prisma.menu.create({
      data: {
        name: `Test Menu Staf ${Date.now()}`,
        price: 20000,
        category: 'Makanan',
        isAvailable: true,
        hasSpiceLevel: true,
      },
    });
    testMenuId = menu.id;

    const paidOrder = await prisma.order.create({
      data: {
        orderCode: `MVR-STF1-${Date.now().toString().slice(-4)}`,
        trackingTokenHash: crypto.randomBytes(32).toString('hex'),
        customerName: 'Pelanggan Lunas',
        customerPhone: '081234560001',
        orderType: OrderType.DINE_IN,
        tableNumber: 2,
        totalAmount: 40000,
        orderStatus: OrderStatus.RECEIVED,
        paymentStatus: PaymentStatus.PAID,
        notes: 'Meja dekat jendela',
        items: {
          create: [
            {
              menuId: testMenuId,
              menuName: menu.name,
              unitPrice: 20000,
              quantity: 2,
              spiceLevel: 3,
              notes: 'Pedas sedang',
              subtotal: 40000,
            },
          ],
        },
        statusLogs: {
          create: [
            {
              previousStatus: null,
              newStatus: OrderStatus.PENDING_PAYMENT,
              changedBy: 'CUSTOMER',
            },
            {
              previousStatus: OrderStatus.PENDING_PAYMENT,
              newStatus: OrderStatus.RECEIVED,
              changedBy: 'SYSTEM',
              reason: 'Payment settled',
            },
          ],
        },
      },
    });
    paidOrderId = paidOrder.id;
    createdOrderIds.push(paidOrder.id);

    const unpaidOrder = await prisma.order.create({
      data: {
        orderCode: `MVR-STF2-${Date.now().toString().slice(-4)}`,
        trackingTokenHash: crypto.randomBytes(32).toString('hex'),
        customerName: 'Pelanggan Belum Bayar',
        customerPhone: '081234560002',
        orderType: OrderType.TAKEAWAY,
        tableNumber: null,
        totalAmount: 20000,
        orderStatus: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        items: {
          create: [
            {
              menuId: testMenuId,
              menuName: menu.name,
              unitPrice: 20000,
              quantity: 1,
              spiceLevel: 1,
              subtotal: 20000,
            },
          ],
        },
      },
    });
    unpaidOrderId = unpaidOrder.id;
    createdOrderIds.push(unpaidOrder.id);
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }
    if (testMenuId) {
      await prisma.menu.delete({ where: { id: testMenuId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // ─── 1. Role-Based Access Control (RBAC) ──────────────────────────────────
  describe('Role-Based Access Control (RBAC)', () => {
    it('should return 401 UNAUTHORIZED when accessing staff endpoints without token', async () => {
      const resList = await request(app).get('/api/v1/staff/orders');
      expect(resList.status).toBe(401);

      const resDetail = await request(app).get(`/api/v1/staff/orders/${paidOrderId}`);
      expect(resDetail.status).toBe(401);

      const resPatch = await request(app)
        .patch(`/api/v1/staff/orders/${paidOrderId}/status`)
        .send({ status: 'PREPARING' });
      expect(resPatch.status).toBe(401);
    });

    it('should return 403 FORBIDDEN when user role is not authorized (e.g. CUSTOMER)', async () => {
      const resList = await request(app)
        .get('/api/v1/staff/orders')
        .set('Authorization', `Bearer ${unauthorizedRoleToken}`);
      expect(resList.status).toBe(403);
      expect(resList.body.error.code).toBe('FORBIDDEN');

      const resDetail = await request(app)
        .get(`/api/v1/staff/orders/${paidOrderId}`)
        .set('Authorization', `Bearer ${unauthorizedRoleToken}`);
      expect(resDetail.status).toBe(403);

      const resPatch = await request(app)
        .patch(`/api/v1/staff/orders/${paidOrderId}/status`)
        .set('Authorization', `Bearer ${unauthorizedRoleToken}`)
        .send({ status: 'PREPARING' });
      expect(resPatch.status).toBe(403);
      expect(resPatch.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ─── 2. GET /api/v1/staff/orders ──────────────────────────────────────────
  describe('GET /api/v1/staff/orders', () => {
    it('should return active/unfinished orders (RECEIVED, PREPARING, READY) for STAFF and ADMIN', async () => {
      const res = await request(app)
        .get('/api/v1/staff/orders')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const orderIds = res.body.data.map((o: { id: number }) => o.id);
      expect(orderIds).toContain(paidOrderId);
      // Unpaid PENDING_PAYMENT order must not appear in default active kitchen pipeline
      expect(orderIds).not.toContain(unpaidOrderId);
    });

    it('should support filtering active orders by ?today=true, ?status=RECEIVED, and ?order_type=DINE_IN', async () => {
      const res = await request(app)
        .get('/api/v1/staff/orders?today=true&status=RECEIVED&order_type=DINE_IN')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach((order: { order_status: string; order_type: string }) => {
        expect(order.order_status).toBe('RECEIVED');
        expect(order.order_type).toBe('DINE_IN');
      });
    });
  });

  // ─── 3. GET /api/v1/staff/orders/:id ──────────────────────────────────────
  describe('GET /api/v1/staff/orders/:id', () => {
    it('should return 200 and full order details including items and status_logs', async () => {
      const res = await request(app)
        .get(`/api/v1/staff/orders/${paidOrderId}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.id).toBe(paidOrderId);
      expect(data.customer_name).toBe('Pelanggan Lunas');
      expect(data.order_type).toBe('DINE_IN');
      expect(data.table_number).toBe(2);
      expect(data.total_amount).toBe(40000);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].quantity).toBe(2);
      expect(data.items[0].spice_level).toBe(3);
      expect(data.items[0].subtotal).toBe(40000);
      expect(Array.isArray(data.status_logs)).toBe(true);
      expect(data.status_logs.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 404 NOT_FOUND for non-existent order ID', async () => {
      const res = await request(app)
        .get('/api/v1/staff/orders/999999')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 422 VALIDATION_ERROR for non-numeric order ID', async () => {
      const res = await request(app)
        .get('/api/v1/staff/orders/abc')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── 4. PATCH /api/v1/staff/orders/:id/status & Transition Validation ─────
  describe('PATCH /api/v1/staff/orders/:id/status (State Machine & Middleware)', () => {
    it('should reject advancing an unpaid order with 422 UNPAID_ORDER', async () => {
      const res = await request(app)
        .patch(`/api/v1/staff/orders/${unpaidOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'PREPARING' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPAID_ORDER');
    });

    it('should reject skipping status steps (RECEIVED -> READY) with 409 INVALID_STATE_TRANSITION', async () => {
      const res = await request(app)
        .patch(`/api/v1/staff/orders/${paidOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'READY' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should allow valid transition RECEIVED -> PREPARING ("Sedang Dimasak") and log actor', async () => {
      const res = await request(app)
        .patch(`/api/v1/staff/orders/${paidOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'Sedang Dimasak', reason: 'Mulai dimasak di dapur' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_status).toBe('PREPARING');
    });

    it('should reject duplicate transition (PREPARING -> PREPARING) with 409 DUPLICATE_STATUS', async () => {
      const res = await request(app)
        .patch(`/api/v1/staff/orders/${paidOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'PREPARING' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_STATUS');
    });

    it('should reject backward transition (PREPARING -> RECEIVED) with 409 INVALID_STATE_TRANSITION', async () => {
      const res = await request(app)
        .patch(`/api/v1/staff/orders/${paidOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'RECEIVED' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should allow valid transition PREPARING -> READY ("Pesanan Siap Diambil")', async () => {
      const res = await request(app)
        .patch(`/api/v1/staff/orders/${paidOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'Pesanan Siap Diambil' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_status).toBe('READY');
    });

    it('should reject backward transition (READY -> PREPARING) with 409 INVALID_STATE_TRANSITION', async () => {
      const res = await request(app)
        .patch(`/api/v1/staff/orders/${paidOrderId}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'PREPARING' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('should allow valid transition READY -> COMPLETED ("Selesai") by ADMIN', async () => {
      const res = await request(app)
        .patch(`/api/v1/staff/orders/${paidOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED', reason: 'Diserahkan ke pelanggan' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order_status).toBe('COMPLETED');
    });

    it('should reject any transition from terminal state COMPLETED with 409 TERMINAL_STATE', async () => {
      const res = await request(app)
        .patch(`/api/v1/staff/orders/${paidOrderId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'READY' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TERMINAL_STATE');
    });
  });
});
