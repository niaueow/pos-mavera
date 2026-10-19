import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { OrderType, OrderStatus, PaymentStatus } from '@prisma/client';

describe('Milestone 3: Order Tracking API (GET /api/v1/orders/:orderCode)', () => {
  let app: Application;
  let testOrderCode: string;
  let rawTrackingToken: string;
  let testOrderId: number;
  let testMenuId: number;
  const createdOrderIds: number[] = [];
  const tempMenuIds: number[] = [];

  beforeAll(async () => {
    app = createApp();

    // 1. Create a menu item
    const menu = await prisma.menu.create({
      data: {
        name: `Tracking Test Menu ${Date.now()}`,
        price: 22000,
        category: 'Makanan',
        isAvailable: true,
      },
    });
    testMenuId = menu.id;
    tempMenuIds.push(menu.id);

    // 2. Generate tracking token and hash
    rawTrackingToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawTrackingToken).digest('hex');

    // 3. Create a test order
    testOrderCode = `MVR-TRK-${Date.now().toString().slice(-6)}`;
    const order = await prisma.order.create({
      data: {
        orderCode: testOrderCode,
        trackingTokenHash: tokenHash,
        customerName: 'Rudi Pelanggan',
        customerPhone: '081233445566',
        orderType: OrderType.DINE_IN,
        tableNumber: 7,
        totalAmount: 44000,
        orderStatus: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        items: {
          create: [
            {
              menuId: testMenuId,
              menuName: menu.name,
              unitPrice: 22000,
              quantity: 2,
              spiceLevel: 1,
              notes: 'Bungkus terpisah',
              subtotal: 44000,
            },
          ],
        },
      },
    });
    testOrderId = order.id;
    createdOrderIds.push(order.id);
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
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

  it('harus mengembalikan 401 jika header X-Order-Tracking-Token tidak disertakan', async () => {
    const res = await request(app).get(`/api/v1/orders/${testOrderCode}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('harus mengembalikan 401 jika header X-Order-Tracking-Token kosong atau hanya whitespace', async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${testOrderCode}`)
      .set('X-Order-Tracking-Token', '   ');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('harus mengembalikan 404 jika orderCode tidak ditemukan di database', async () => {
    const res = await request(app)
      .get('/api/v1/orders/MVR-NONEXISTENT')
      .set('X-Order-Tracking-Token', rawTrackingToken);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('harus mengembalikan 401 jika tracking token salah (tidak cocok)', async () => {
    const wrongToken = 'wrong-tracking-token-1234567890abcdef1234567890abcdef';
    const res = await request(app)
      .get(`/api/v1/orders/${testOrderCode}`)
      .set('X-Order-Tracking-Token', wrongToken);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Token pelacakan tidak valid');
  });

  it('harus mengembalikan 200 dengan data pesanan lengkap jika token valid', async () => {
    const res = await request(app)
      .get(`/api/v1/orders/${testOrderCode}`)
      .set('X-Order-Tracking-Token', rawTrackingToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.orderCode).toBe(testOrderCode);
    expect(data.totalPrice).toBe(44000);
    expect(data.paymentStatus).toBe('PENDING');
    expect(data.orderStatus).toBe('PENDING_PAYMENT');
    expect(data.status).toBe('MENUNGGU_PEMBAYARAN');
    expect(data.items).toHaveLength(1);
    expect(data.items[0].menuName).toContain('Tracking Test Menu');
    expect(data.items[0].quantity).toBe(2);
    expect(data.items[0].subtotal).toBe(44000);

    // Pastikan field internal/sensitif tidak diekspos
    expect(data.trackingTokenHash).toBeUndefined();
    expect(data.trackingToken).toBeUndefined();
    expect(data.tracking_token).toBeUndefined();
  });

  it('harus memetakan status terkini sesuai siklus pesanan (RECEIVED -> DITERIMA, PREPARING -> DIPROSES, COMPLETED -> SELESAI)', async () => {
    // Ubah status ke RECEIVED
    await prisma.order.update({
      where: { id: testOrderId },
      data: { orderStatus: OrderStatus.RECEIVED, paymentStatus: PaymentStatus.PAID },
    });

    let res = await request(app)
      .get(`/api/v1/orders/${testOrderCode}`)
      .set('X-Order-Tracking-Token', rawTrackingToken);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DITERIMA');

    // Ubah status ke PREPARING
    await prisma.order.update({
      where: { id: testOrderId },
      data: { orderStatus: OrderStatus.PREPARING },
    });

    res = await request(app)
      .get(`/api/v1/orders/${testOrderCode}`)
      .set('X-Order-Tracking-Token', rawTrackingToken);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('DIPROSES');

    // Ubah status ke COMPLETED
    await prisma.order.update({
      where: { id: testOrderId },
      data: { orderStatus: OrderStatus.COMPLETED },
    });

    res = await request(app)
      .get(`/api/v1/orders/${testOrderCode}`)
      .set('X-Order-Tracking-Token', rawTrackingToken);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SELESAI');
  });
});
