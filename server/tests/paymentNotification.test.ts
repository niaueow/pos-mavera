import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Application } from 'express';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';
import { env } from '../src/config/env';
import { generateMidtransSignature } from '../src/utils/midtransSignature';
import { OrderType, OrderStatus, PaymentStatus } from '@prisma/client';

describe('Milestone 2: Webhook Notifikasi Midtrans (POST /api/v1/payments/notification)', () => {
  let app: Application;
  let testOrderId: number;
  let testOrderCode: string;
  let testAttemptOrderId: string;
  let testPaymentAttemptId: number;
  const createdOrderIds: number[] = [];

  beforeAll(async () => {
    app = createApp();

    // 1. Buat pesanan pengujian
    testOrderCode = `MVR-NOTIF-${Date.now().toString().slice(-6)}`;
    const order = await prisma.order.create({
      data: {
        orderCode: testOrderCode,
        trackingTokenHash: 'dummy-hash-notif-order-1234567890abcdef',
        customerName: 'Budi Webhook',
        customerPhone: '081299887766',
        orderType: OrderType.DINE_IN,
        tableNumber: 4,
        totalAmount: 36000,
        orderStatus: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        items: {
          create: [
            {
              menuName: 'Ayam Geprek Sambal Korek',
              unitPrice: 18000,
              quantity: 2,
              spiceLevel: 3,
              subtotal: 36000,
            },
          ],
        },
      },
    });
    testOrderId = order.id;
    createdOrderIds.push(order.id);

    // 2. Buat PaymentAttempt pengujian
    testAttemptOrderId = `${testOrderCode}-1`;
    const attempt = await prisma.paymentAttempt.create({
      data: {
        orderId: order.id,
        gatewayOrderId: testAttemptOrderId,
        snapToken: 'test-token-webhook-123',
        snapRedirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/test-token-webhook-123',
        grossAmount: 36000,
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });
    testPaymentAttemptId = attempt.id;
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await prisma.orderStatusLog.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
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
    await prisma.$disconnect();
  });

  it('harus mengembalikan 401 Unauthorized jika signature_key tidak valid', async () => {
    const invalidSignaturePayload = {
      order_id: testAttemptOrderId,
      status_code: '200',
      gross_amount: '36000.00',
      signature_key: 'invalid-signature-key-1234567890abcdef1234567890abcdef',
      transaction_status: 'settlement',
    };

    const res = await request(app)
      .post('/api/v1/payments/notification')
      .send(invalidSignaturePayload);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('harus mengembalikan 404 jika order_id tidak ditemukan di database', async () => {
    const nonexistentOrderId = 'MVR-UNKNOWN-99';
    const statusCode = '200';
    const grossAmount = '36000.00';
    const signature = generateMidtransSignature(
      nonexistentOrderId,
      statusCode,
      grossAmount,
      env.MIDTRANS_SERVER_KEY
    );

    const payload = {
      order_id: nonexistentOrderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'settlement',
    };

    const res = await request(app)
      .post('/api/v1/payments/notification')
      .send(payload);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('harus memproses notifikasi pending dan mempertahankan status PENDING', async () => {
    const statusCode = '201';
    const grossAmount = '36000.00';
    const signature = generateMidtransSignature(
      testAttemptOrderId,
      statusCode,
      grossAmount,
      env.MIDTRANS_SERVER_KEY
    );

    const payload = {
      order_id: testAttemptOrderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'pending',
      payment_type: 'qris',
      transaction_id: 'trans-pending-001',
    };

    const res = await request(app)
      .post('/api/v1/payments/notification')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const orderInDb = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(orderInDb?.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(orderInDb?.orderStatus).toBe(OrderStatus.PENDING_PAYMENT);
  });

  it('harus memproses notifikasi settlement: update PaymentAttempt -> PAID, Order -> PAID & RECEIVED, dan mencatat OrderStatusLog', async () => {
    const statusCode = '200';
    const grossAmount = '36000.00';
    const signature = generateMidtransSignature(
      testAttemptOrderId,
      statusCode,
      grossAmount,
      env.MIDTRANS_SERVER_KEY
    );

    const payload = {
      order_id: testAttemptOrderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'settlement',
      payment_type: 'qris',
      transaction_id: 'trans-pending-001',
    };

    const res = await request(app)
      .post('/api/v1/payments/notification')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verifikasi PaymentAttempt terupdate
    const attemptInDb = await prisma.paymentAttempt.findUnique({
      where: { id: testPaymentAttemptId },
    });
    expect(attemptInDb?.status).toBe(PaymentStatus.PAID);
    expect(attemptInDb?.transactionId).toBe('trans-pending-001');
    expect(attemptInDb?.paymentType).toBe('qris');
    expect(attemptInDb?.paidAt).not.toBeNull();

    // Verifikasi Order terupdate ke PAID dan RECEIVED
    const orderInDb = await prisma.order.findUnique({
      where: { id: testOrderId },
      include: { statusLogs: true },
    });
    expect(orderInDb?.paymentStatus).toBe(PaymentStatus.PAID);
    expect(orderInDb?.orderStatus).toBe(OrderStatus.RECEIVED);

    // Verifikasi OrderStatusLog tercipta
    expect(orderInDb?.statusLogs.length).toBeGreaterThan(0);
    const lastLog = orderInDb?.statusLogs[orderInDb.statusLogs.length - 1];
    expect(lastLog?.newStatus).toBe(OrderStatus.RECEIVED);
    expect(lastLog?.changedBy).toBe('MIDTRANS_WEBHOOK');
  });

  it('harus menangani Idempotensi: jika Order sudah PAID, kembalikan 200 OK "Already processed" tanpa modifikasi database', async () => {
    const statusCode = '200';
    const grossAmount = '36000.00';
    const signature = generateMidtransSignature(
      testAttemptOrderId,
      statusCode,
      grossAmount,
      env.MIDTRANS_SERVER_KEY
    );

    const payload = {
      order_id: testAttemptOrderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'settlement',
      payment_type: 'qris',
      transaction_id: 'trans-pending-001',
    };

    const res = await request(app)
      .post('/api/v1/payments/notification')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Already processed');
    expect(res.body.data.isIdempotent).toBe(true);
  });

  it('harus memproses notifikasi expire pada attempt terpisah', async () => {
    // Buat order dan attempt baru khusus untuk uji expire
    const expireOrderCode = `MVR-EXP-${Date.now().toString().slice(-6)}`;
    const expireOrder = await prisma.order.create({
      data: {
        orderCode: expireOrderCode,
        trackingTokenHash: 'dummy-hash-expire-order-1234567890abcdef',
        customerName: 'Doni Expire',
        customerPhone: '081211223344',
        orderType: OrderType.TAKEAWAY,
        totalAmount: 18000,
        orderStatus: OrderStatus.PENDING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
      },
    });
    createdOrderIds.push(expireOrder.id);

    const expireAttemptOrderId = `${expireOrderCode}-1`;
    await prisma.paymentAttempt.create({
      data: {
        orderId: expireOrder.id,
        gatewayOrderId: expireAttemptOrderId,
        grossAmount: 18000,
        status: PaymentStatus.PENDING,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const statusCode = '200';
    const grossAmount = '18000.00';
    const signature = generateMidtransSignature(
      expireAttemptOrderId,
      statusCode,
      grossAmount,
      env.MIDTRANS_SERVER_KEY
    );

    const payload = {
      order_id: expireAttemptOrderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signature,
      transaction_status: 'expire',
      transaction_id: 'trans-expire-001',
    };

    const res = await request(app)
      .post('/api/v1/payments/notification')
      .send(payload);

    expect(res.status).toBe(200);

    const updatedAttempt = await prisma.paymentAttempt.findUnique({
      where: { gatewayOrderId: expireAttemptOrderId },
    });
    expect(updatedAttempt?.status).toBe(PaymentStatus.EXPIRED);

    const updatedOrder = await prisma.order.findUnique({
      where: { id: expireOrder.id },
    });
    expect(updatedOrder?.paymentStatus).toBe(PaymentStatus.EXPIRED);
  });
});
