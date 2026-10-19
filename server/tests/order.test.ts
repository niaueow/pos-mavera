import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import {
  generateOrderCode,
  generateTrackingToken,
  calculateOrderPricing,
} from '../src/services/order.service';

describe('Milestone 2: Customer Order API (POST /api/v1/orders)', () => {
  let app: Application;
  let spicyMenuId: number;
  let spicyMenuPrice: number;
  let drinkMenuId: number;
  let drinkMenuPrice: number;
  let unavailableMenuId: number;
  let deletedMenuId: number;
  const createdOrderIds: number[] = [];
  const tempMenuIds: number[] = [];

  beforeAll(async () => {
    app = createApp();

    // Create dedicated test menu items to ensure deterministic pricing and flags
    const spicyMenu = await prisma.menu.create({
      data: {
        name: `Test Ayam Geprek Pedas ${Date.now()}`,
        price: 18000,
        category: 'Makanan',
        isAvailable: true,
        hasSpiceLevel: true,
        isDeleted: false,
      },
    });
    spicyMenuId = spicyMenu.id;
    spicyMenuPrice = spicyMenu.price;
    tempMenuIds.push(spicyMenu.id);

    const drinkMenu = await prisma.menu.create({
      data: {
        name: `Test Es Teh Manis ${Date.now()}`,
        price: 5000,
        category: 'Minuman',
        isAvailable: true,
        hasSpiceLevel: false,
        isDeleted: false,
      },
    });
    drinkMenuId = drinkMenu.id;
    drinkMenuPrice = drinkMenu.price;
    tempMenuIds.push(drinkMenu.id);

    const unavailableMenu = await prisma.menu.create({
      data: {
        name: `Test Menu Habis ${Date.now()}`,
        price: 20000,
        category: 'Makanan',
        isAvailable: false,
        hasSpiceLevel: true,
        isDeleted: false,
      },
    });
    unavailableMenuId = unavailableMenu.id;
    tempMenuIds.push(unavailableMenu.id);

    const deletedMenu = await prisma.menu.create({
      data: {
        name: `Test Menu Terhapus ${Date.now()}`,
        price: 20000,
        category: 'Makanan',
        isAvailable: true,
        hasSpiceLevel: false,
        isDeleted: true,
      },
    });
    deletedMenuId = deletedMenu.id;
    tempMenuIds.push(deletedMenu.id);
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }
    if (tempMenuIds.length > 0) {
      await prisma.menu.deleteMany({
        where: { id: { in: tempMenuIds } },
      });
    }
    await prisma.$disconnect();
  });

  describe('Unit Tests: Generator & Pricing Functions', () => {
    it('generateOrderCode() should produce MVR-XXXXXX format using unambiguous uppercase charset', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const code = generateOrderCode();
        expect(code).toMatch(/^MVR-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
        codes.add(code);
      }
      expect(codes.size).toBeGreaterThan(15);
    });

    it('generateTrackingToken() should produce a 64-char hex rawToken and matching SHA-256 tokenHash', () => {
      const { rawToken, tokenHash } = generateTrackingToken();
      expect(rawToken).toMatch(/^[0-9a-f]{64}$/);
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(tokenHash).not.toBe(rawToken);

      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(tokenHash).toBe(expectedHash);
    });

    it('calculateOrderPricing() should compute authoritative subtotals and totalAmount from database Menu records', async () => {
      const menus = await prisma.menu.findMany({
        where: { id: { in: [spicyMenuId, drinkMenuId] } },
      });
      const menuMap = new Map(menus.map((m) => [m.id, m]));

      const result = calculateOrderPricing(
        [
          { menuId: spicyMenuId, quantity: 2, spiceLevel: 3, notes: 'Pedas sedang' },
          { menuId: drinkMenuId, quantity: 3, spiceLevel: null, notes: null },
        ],
        menuMap
      );

      expect(result.items).toHaveLength(2);
      expect(result.items[0].unitPrice).toBe(spicyMenuPrice);
      expect(result.items[0].subtotal).toBe(spicyMenuPrice * 2);
      expect(result.items[1].unitPrice).toBe(drinkMenuPrice);
      expect(result.items[1].subtotal).toBe(drinkMenuPrice * 3);
      expect(result.totalAmount).toBe(spicyMenuPrice * 2 + drinkMenuPrice * 3);
    });
  });

  describe('POST /api/v1/orders — Valid Guest Checkout', () => {
    it('should create a DINE_IN order (201) with valid table_number (1-10), calculate total server-side, and return tracking_token', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customer: {
            name: 'Budi Santoso',
            phone_number: '081234567890',
          },
          order_type: 'DINE_IN',
          table_number: 5,
          notes: 'Tolong disajikan bersamaan',
          items: [
            {
              menu_id: spicyMenuId,
              quantity: 2,
              spice_level: 3,
              notes: 'Sambal dipisah',
            },
            {
              menu_id: drinkMenuId,
              quantity: 1,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Order created successfully');

      const data = res.body.data;
      createdOrderIds.push(data.id);

      expect(data.order_code).toMatch(/^MVR-[A-Z0-9]{6}$/);
      expect(data.order_type).toBe('DINE_IN');
      expect(data.table_number).toBe(5);
      expect(data.customer_name).toBe('Budi Santoso');
      expect(data.customer_phone).toBe('081234567890');
      expect(data.order_status).toBe('PENDING_PAYMENT');
      expect(data.payment_status).toBe('PENDING');
      expect(data.tracking_token).toMatch(/^[0-9a-f]{64}$/);

      const expectedTotal = spicyMenuPrice * 2 + drinkMenuPrice * 1;
      expect(data.total).toBe(expectedTotal);
      expect(data.total_amount).toBe(expectedTotal);
      expect(data.items).toHaveLength(2);

      // Verify DB stores SHA-256 hash of tracking_token, never the raw token
      const dbOrder = await prisma.order.findUnique({
        where: { id: data.id },
        include: { statusLogs: true },
      });
      expect(dbOrder).not.toBeNull();
      const expectedHash = crypto
        .createHash('sha256')
        .update(data.tracking_token)
        .digest('hex');
      expect(dbOrder?.trackingTokenHash).toBe(expectedHash);
      expect(dbOrder?.trackingTokenHash).not.toBe(data.tracking_token);
      expect(dbOrder?.statusLogs).toHaveLength(1);
      expect(dbOrder?.statusLogs[0].newStatus).toBe('PENDING_PAYMENT');
    });

    it('should create a TAKEAWAY order (201) when table_number is omitted or null', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Siti Rahma',
          customer_phone: '081298765432',
          order_type: 'TAKEAWAY',
          items: [
            {
              menu_id: spicyMenuId,
              quantity: 1,
              spice_level: 0,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      createdOrderIds.push(res.body.data.id);

      expect(res.body.data.order_type).toBe('TAKEAWAY');
      expect(res.body.data.table_number).toBeNull();
      expect(res.body.data.total).toBe(spicyMenuPrice);
      expect(res.body.data.items[0].spice_level).toBe(0);
    });

    it('should ignore client-supplied manipulated prices and totals (anti-price tampering)', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Hacker Tamper',
          customer_phone: '081200001111',
          order_type: 'TAKEAWAY',
          total: 1,
          total_amount: 1,
          items: [
            {
              menu_id: spicyMenuId,
              quantity: 3,
              spice_level: 5,
              price: 1,
              unit_price: 1,
              subtotal: 3,
            },
          ],
        });

      expect(res.status).toBe(201);
      createdOrderIds.push(res.body.data.id);

      // Must equal 3 * 18000 = 54000, not the tampered value of 3 or 1
      expect(res.body.data.items[0].unit_price).toBe(spicyMenuPrice);
      expect(res.body.data.items[0].subtotal).toBe(spicyMenuPrice * 3);
      expect(res.body.data.total).toBe(spicyMenuPrice * 3);
    });
  });

  describe('POST /api/v1/orders — Input, Table Number & Spice Level Validations', () => {
    it('should return 422 VALIDATION_ERROR for invalid order_type', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'DELIVERY',
          items: [{ menu_id: drinkMenuId, quantity: 1 }],
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 VALIDATION_ERROR when DINE_IN order omits table_number', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'DINE_IN',
          items: [{ menu_id: drinkMenuId, quantity: 1 }],
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(
        res.body.error.details.some((d: { field: string }) => d.field === 'table_number')
      ).toBe(true);
    });

    it('should return 422 VALIDATION_ERROR when DINE_IN table_number is out of range (0 or 11)', async () => {
      const resZero = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'DINE_IN',
          table_number: 0,
          items: [{ menu_id: drinkMenuId, quantity: 1 }],
        });
      expect(resZero.status).toBe(422);

      const resEleven = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'DINE_IN',
          table_number: 11,
          items: [{ menu_id: drinkMenuId, quantity: 1 }],
        });
      expect(resEleven.status).toBe(422);
      expect(
        resEleven.body.error.details.some((d: { field: string }) => d.field === 'table_number')
      ).toBe(true);
    });

    it('should return 422 VALIDATION_ERROR when TAKEAWAY order includes a table_number', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'TAKEAWAY',
          table_number: 4,
          items: [{ menu_id: drinkMenuId, quantity: 1 }],
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(
        res.body.error.details.some((d: { field: string }) => d.field === 'table_number')
      ).toBe(true);
    });

    it('should return 422 VALIDATION_ERROR when spicy menu is ordered without spice_level', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'TAKEAWAY',
          items: [{ menu_id: spicyMenuId, quantity: 1 }],
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(
        res.body.error.details.some((d: { field: string }) => d.field.includes('spice_level'))
      ).toBe(true);
    });

    it('should return 422 VALIDATION_ERROR when non-spicy menu (drink) is ordered with a spice_level', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'TAKEAWAY',
          items: [{ menu_id: drinkMenuId, quantity: 1, spice_level: 2 }],
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(
        res.body.error.details.some((d: { field: string }) => d.field.includes('spice_level'))
      ).toBe(true);
    });

    it('should return 422 VALIDATION_ERROR when spice_level is outside 0..5', async () => {
      const res = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'TAKEAWAY',
          items: [{ menu_id: spicyMenuId, quantity: 1, spice_level: 6 }],
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 VALIDATION_ERROR when ordering unavailable, soft-deleted, or non-existent menu items', async () => {
      const resUnavailable = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'TAKEAWAY',
          items: [{ menu_id: unavailableMenuId, quantity: 1, spice_level: 2 }],
        });
      expect(resUnavailable.status).toBe(422);

      const resDeleted = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'TAKEAWAY',
          items: [{ menu_id: deletedMenuId, quantity: 1 }],
        });
      expect(resDeleted.status).toBe(422);

      const resNonExistent = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'TAKEAWAY',
          items: [{ menu_id: 999999, quantity: 1 }],
        });
      expect(resNonExistent.status).toBe(422);
    });

    it('should return 422 VALIDATION_ERROR for empty items array or invalid quantity', async () => {
      const resEmpty = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'TAKEAWAY',
          items: [],
        });
      expect(resEmpty.status).toBe(422);

      const resZeroQty = await request(app)
        .post('/api/v1/orders')
        .send({
          customer_name: 'Budi',
          customer_phone: '081234567890',
          order_type: 'TAKEAWAY',
          items: [{ menu_id: drinkMenuId, quantity: 0 }],
        });
      expect(resZeroQty.status).toBe(422);
    });
  });
});
