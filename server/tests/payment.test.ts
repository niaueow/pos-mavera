import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { snap } from '../src/config/midtrans';
import { OrderType, OrderStatus, PaymentStatus } from '@prisma/client';

describe('Payment & Tracking API: POST /api/v1/orders/:orderCode/payment-attempts', () => {
  let app: Application;
  let testMenuId: number;
  let unpaidOrderCode: string;
  let unpaidOrderId: number;
  let paidOrderCode: string;
  let paidOrderId: number;

  const createdOrderIds: number[] = [];
  const tempMenuIds: number[] = [];

  beforeAll(async () => {
    app = createApp();

    // 1. Create a test menu item
    const menu = await prisma.menu.create({
      data: {
        name: `Payment Test Menu ${Date.now()}`,
        price: 25000,
        category: 'Makanan',
        isAvailable: true,
        hasSpiceLevel: true,
      },
    });
    testMenuId = menu.id;
    tempMenuIds.push(menu.id);

    // 2. Create an unpaid test order
    unpaidOrderCode = `MVR-TEST-${Date.now().toString().slice(-6)}`;
    const unpaidOrder = await prisma.order.create({
      data: {
        orderCode: unpaidOrderCode,
        trackingTokenHash: 'dummy-hash-unpaid-order-1234567890abcdef',
        customerName: 'Ahmad Dahlan',
        customerPhone: '081234567891',
        orderType: OrderType.DINE_IN,
        tableNumber: 3,
        totalAmount: 50000,
        orderStatus: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        items: {
          create: [
            {
              menuId: testMenuId,
              menuName: menu.name,
              unitPrice: 25000,
              quantity: 2,
              spiceLevel: 2,
              notes: 'Tidak terlalu pedas',
              subtotal: 50000,
            },
          ],
        },
      },
    });
    unpaidOrderId = unpaidOrder.id;
    createdOrderIds.push(unpaidOrder.id);

    // 3. Create an already paid order
    paidOrderCode = `MVR-PAID-${Date.now().toString().slice(-6)}`;
    const paidOrder = await prisma.order.create({
      data: {
        orderCode: paidOrderCode,
        trackingTokenHash: 'dummy-hash-paid-order-1234567890abcdef',
        customerName: 'Siti Rahma',
        customerPhone: '081987654321',
        orderType: OrderType.TAKEAWAY,
        totalAmount: 25000,
        orderStatus: OrderStatus.RECEIVED,
        paymentStatus: PaymentStatus.PAID,
        items: {
          create: [
            {
              menuId: testMenuId,
              menuName: menu.name,
              unitPrice: 25000,
              quantity: 1,
              subtotal: 25000,
            },
          ],
        },
      },
    });
    paidOrderId = paidOrder.id;
    createdOrderIds.push(paidOrder.id);
  });

  afterAll(async () => {
    // Cleanup created test records
    if (createdOrderIds.length > 0) {
      await prisma.paymentAttempt.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
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

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 404 when orderCode does not exist', async () => {
    const res = await request(app)
      .post('/api/v1/orders/MVR-NONEXISTENT/payment-attempts')
      .send();

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return 409 Conflict when order is already PAID', async () => {
    const res = await request(app)
      .post(`/api/v1/orders/${paidOrderCode}/payment-attempts`)
      .send();

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('should create a new payment attempt (201) with Midtrans Snap details and persist in database', async () => {
    const mockSnapToken = 'snap-token-test-123456';
    const mockRedirectUrl = 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-test-123456';

    const createTransactionSpy = vi
      .spyOn(snap, 'createTransaction')
      .mockResolvedValueOnce({
        token: mockSnapToken,
        redirect_url: mockRedirectUrl,
      });

    const res = await request(app)
      .post(`/api/v1/orders/${unpaidOrderCode}/payment-attempts`)
      .send();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.orderCode).toBe(unpaidOrderCode);
    expect(data.gatewayOrderId).toBe(`${unpaidOrderCode}-1`);
    expect(data.snapToken).toBe(mockSnapToken);
    expect(data.snapRedirectUrl).toBe(mockRedirectUrl);
    expect(data.expiresAt).toBeDefined();

    // Verify spy was called with expected payload
    expect(createTransactionSpy).toHaveBeenCalledTimes(1);
    const passedPayload = createTransactionSpy.mock.calls[0][0] as any;
    expect(passedPayload.transaction_details.order_id).toBe(`${unpaidOrderCode}-1`);
    expect(passedPayload.transaction_details.gross_amount).toBe(50000);
    expect(passedPayload.item_details).toHaveLength(1);
    expect(passedPayload.item_details[0].price).toBe(25000);
    expect(passedPayload.item_details[0].quantity).toBe(2);
    expect(passedPayload.customer_details.first_name).toBe('Ahmad Dahlan');
    expect(passedPayload.customer_details.phone).toBe('081234567891');
    expect(passedPayload.expiry).toEqual({ unit: 'minutes', duration: 15 });

    // Verify persisted PaymentAttempt in DB
    const persistedAttempt = await prisma.paymentAttempt.findUnique({
      where: { gatewayOrderId: `${unpaidOrderCode}-1` },
    });
    expect(persistedAttempt).not.toBeNull();
    expect(persistedAttempt?.orderId).toBe(unpaidOrderId);
    expect(persistedAttempt?.snapToken).toBe(mockSnapToken);
    expect(persistedAttempt?.snapRedirectUrl).toBe(mockRedirectUrl);
    expect(persistedAttempt?.grossAmount).toBe(50000);
    expect(persistedAttempt?.status).toBe(PaymentStatus.PENDING);
  });

  it('should be idempotent: return 200 with existing snapToken if an active PENDING attempt exists', async () => {
    const createTransactionSpy = vi.spyOn(snap, 'createTransaction');

    const res = await request(app)
      .post(`/api/v1/orders/${unpaidOrderCode}/payment-attempts`)
      .send();

    // Idempotency: HTTP 200 and return existing active token
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.orderCode).toBe(unpaidOrderCode);
    expect(data.gatewayOrderId).toBe(`${unpaidOrderCode}-1`);
    expect(data.snapToken).toBe('snap-token-test-123456');
    expect(data.snapRedirectUrl).toBe('https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-test-123456');

    // snap.createTransaction should NOT have been called again
    expect(createTransactionSpy).not.toHaveBeenCalled();

    // Only 1 attempt should exist in database
    const attempts = await prisma.paymentAttempt.findMany({
      where: { orderId: unpaidOrderId },
    });
    expect(attempts).toHaveLength(1);
  });

  it('should create attempt #2 (201) with gatewayOrderId `${orderCode}-2` if previous attempt is expired', async () => {
    // Manually mark the existing attempt as expired
    await prisma.paymentAttempt.update({
      where: { gatewayOrderId: `${unpaidOrderCode}-1` },
      data: {
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      },
    });

    const mockSnapToken2 = 'snap-token-attempt-2-789012';
    const mockRedirectUrl2 = 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-attempt-2-789012';

    const createTransactionSpy = vi
      .spyOn(snap, 'createTransaction')
      .mockResolvedValueOnce({
        token: mockSnapToken2,
        redirect_url: mockRedirectUrl2,
      });

    const res = await request(app)
      .post(`/api/v1/orders/${unpaidOrderCode}/payment-attempts`)
      .send();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.orderCode).toBe(unpaidOrderCode);
    expect(data.gatewayOrderId).toBe(`${unpaidOrderCode}-2`);
    expect(data.snapToken).toBe(mockSnapToken2);
    expect(data.snapRedirectUrl).toBe(mockRedirectUrl2);

    expect(createTransactionSpy).toHaveBeenCalledTimes(1);

    // Now 2 attempts should exist in database
    const attempts = await prisma.paymentAttempt.findMany({
      where: { orderId: unpaidOrderId },
      orderBy: { createdAt: 'asc' },
    });
    expect(attempts).toHaveLength(2);
    expect(attempts[0].gatewayOrderId).toBe(`${unpaidOrderCode}-1`);
    expect(attempts[1].gatewayOrderId).toBe(`${unpaidOrderCode}-2`);
  });

  it('should return 502 PAYMENT_GATEWAY_ERROR when Midtrans SDK throws an error', async () => {
    // Expire attempt #2 so it tries to create attempt #3
    await prisma.paymentAttempt.update({
      where: { gatewayOrderId: `${unpaidOrderCode}-2` },
      data: {
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    vi.spyOn(snap, 'createTransaction').mockRejectedValueOnce(
      new Error('Midtrans API connection timed out')
    );

    const res = await request(app)
      .post(`/api/v1/orders/${unpaidOrderCode}/payment-attempts`)
      .send();

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PAYMENT_GATEWAY_ERROR');
  });
});
