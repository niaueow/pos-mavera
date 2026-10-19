import { OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { assertMidtransConfigured } from '../config/midtrans';
import { AppError } from '../middlewares/errorHandler';
import { verifyMidtransSignature } from '../utils/midtransSignature';
import { env } from '../config/env';

export interface MidtransNotificationPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  payment_type?: string;
  transaction_time?: string;
  settlement_time?: string;
  [key: string]: unknown;
}

export interface ProcessNotificationResult {
  message: string;
  orderCode: string;
  gatewayOrderId: string;
  isIdempotent?: boolean;
}

function getDatabaseTargetIdentifier(): string {
  try {
    const databaseUrl = new URL(env.DATABASE_URL);
    const databaseName = databaseUrl.pathname.replace(/^\//, '') || 'unknown';
    return `${databaseUrl.hostname}:${databaseUrl.port || 'default'}/${databaseName}`;
  } catch {
    return 'unparseable-database-url';
  }
}

export class PaymentService {
  /**
   * Process incoming Midtrans webhook notification.
   * Handles signature verification, idempotency, and transactional order/attempt status updates.
   */
  async processNotification(payload: MidtransNotificationPayload): Promise<ProcessNotificationResult> {
    try {
      assertMidtransConfigured();
    } catch {
      throw new AppError(503, 'PAYMENT_CONFIGURATION_ERROR', 'Payment gateway belum dikonfigurasi');
    }

    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, transaction_id, payment_type } =
      payload;

    console.info('[MidtransWebhook] received', {
      environment: env.NODE_ENV,
      isProduction: env.MIDTRANS_IS_PRODUCTION === true,
      databaseTarget: getDatabaseTargetIdentifier(),
      orderId: typeof order_id === 'string' ? order_id : 'invalid',
      transactionStatus: typeof transaction_status === 'string' ? transaction_status : 'invalid',
    });

    if (
      typeof order_id !== 'string' ||
      typeof status_code !== 'string' ||
      typeof gross_amount !== 'string' ||
      typeof signature_key !== 'string' ||
      typeof transaction_status !== 'string'
    ) {
      throw new AppError(400, 'BAD_REQUEST', 'Payload notifikasi tidak lengkap');
    }

    // 1. Verifikasi signature key
    const isValidSignature = verifyMidtransSignature({
      orderId: order_id,
      statusCode: status_code,
      grossAmount: gross_amount,
      signatureKey: signature_key,
    });

    if (!isValidSignature) {
      console.warn('[MidtransWebhook] signature rejected', {
        orderId: order_id,
      });
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid Midtrans signature key');
    }

    console.info('[MidtransWebhook] signature accepted', {
      orderId: order_id,
    });

    const result = await prisma.$transaction(async (tx) => {
      const paymentAttempt = await tx.paymentAttempt.findUnique({
        where: { gatewayOrderId: order_id },
        include: { order: true },
      });

      if (!paymentAttempt) {
        console.warn('[MidtransWebhook] payment attempt lookup missed', {
          orderId: order_id,
        });
        throw new AppError(
          404,
          'NOT_FOUND',
          `Payment attempt dengan order_id ${order_id} tidak ditemukan`
        );
      }

      console.info('[MidtransWebhook] payment attempt lookup matched', {
        orderId: order_id,
        paymentAttemptId: paymentAttempt.id,
        orderIdForeignKey: paymentAttempt.orderId,
        orderFound: Boolean(paymentAttempt.order),
        orderCode: paymentAttempt.order.orderCode,
      });

      const notificationAmount = Number(gross_amount);
      if (!Number.isFinite(notificationAmount) || notificationAmount !== paymentAttempt.grossAmount) {
        throw new AppError(422, 'PAYMENT_MISMATCH', 'Jumlah pembayaran tidak sesuai dengan payment attempt');
      }
      if (paymentAttempt.transactionId && transaction_id && paymentAttempt.transactionId !== transaction_id) {
        throw new AppError(422, 'PAYMENT_MISMATCH', 'Transaction identifier tidak sesuai dengan payment attempt');
      }

      const paid =
        transaction_status === 'settlement' ||
        (transaction_status === 'capture' && (!fraud_status || fraud_status === 'accept'));
      const pending =
        transaction_status === 'pending' ||
        (transaction_status === 'capture' && fraud_status === 'challenge');
      const failed = transaction_status === 'deny' || transaction_status === 'cancel';
      const expired = transaction_status === 'expire';

      if (!paid && !pending && !failed && !expired) {
        return {
          message: `Notification received with status ${transaction_status}`,
          orderCode: paymentAttempt.order.orderCode,
          gatewayOrderId: order_id,
          isIdempotent: true,
        };
      }

      if (
        paymentAttempt.status === PaymentStatus.PAID ||
        (!paid &&
          (paymentAttempt.status === PaymentStatus.FAILED ||
            paymentAttempt.status === PaymentStatus.EXPIRED ||
            paymentAttempt.status === PaymentStatus.CANCELLED))
      ) {
        return {
          message: 'Already processed',
          orderCode: paymentAttempt.order.orderCode,
          gatewayOrderId: order_id,
          isIdempotent: true,
        };
      }

      const targetStatus = paid
        ? PaymentStatus.PAID
        : pending
        ? PaymentStatus.PENDING
        : expired
        ? PaymentStatus.EXPIRED
        : PaymentStatus.FAILED;

      console.info('[MidtransWebhook] applying payment attempt update', {
        orderId: order_id,
        paymentAttemptId: paymentAttempt.id,
        targetStatus,
      });

      const updatedPaymentAttempt = await tx.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: targetStatus,
          paidAt: paid ? paymentAttempt.paidAt ?? new Date() : paymentAttempt.paidAt,
          transactionId: transaction_id ?? paymentAttempt.transactionId,
          paymentType: payment_type ?? paymentAttempt.paymentType,
          gatewayTransactionStatus: transaction_status,
          gatewayFraudStatus: fraud_status ?? paymentAttempt.gatewayFraudStatus,
        },
      });

      console.info('[MidtransWebhook] payment attempt update complete', {
        orderId: order_id,
        paymentAttemptId: updatedPaymentAttempt.id,
        updatedCount: 1,
        status: updatedPaymentAttempt.status,
      });

      if (paid) {
        const updatedOrder = await tx.order.update({
          where: { id: paymentAttempt.order.id },
          data: {
            paymentStatus: PaymentStatus.PAID,
            ...(paymentAttempt.order.orderStatus === OrderStatus.PENDING_PAYMENT
              ? { orderStatus: OrderStatus.RECEIVED }
              : {}),
          },
        });

        console.info('[MidtransWebhook] order update complete', {
          orderId: order_id,
          orderIdForeignKey: updatedOrder.id,
          updatedCount: 1,
          paymentStatus: updatedOrder.paymentStatus,
          orderStatus: updatedOrder.orderStatus,
        });

        if (paymentAttempt.order.orderStatus === OrderStatus.PENDING_PAYMENT) {
          await tx.orderStatusLog.create({
            data: {
              orderId: paymentAttempt.order.id,
              previousStatus: paymentAttempt.order.orderStatus,
              newStatus: OrderStatus.RECEIVED,
              changedBy: 'MIDTRANS_WEBHOOK',
              reason: `Pembayaran berhasil terverifikasi (${payment_type ?? 'midtrans'})`,
            },
          });
        }

        return {
          message: 'Payment confirmed successfully',
          orderCode: paymentAttempt.order.orderCode,
          gatewayOrderId: order_id,
        };
      } else if (!pending) {
        const remainingActiveAttempts = await tx.paymentAttempt.count({
          where: {
            orderId: paymentAttempt.order.id,
            id: { not: paymentAttempt.id },
            status: PaymentStatus.PENDING,
            expiresAt: { gt: new Date() },
          },
        });

        if (remainingActiveAttempts === 0 && paymentAttempt.order.paymentStatus !== PaymentStatus.PAID) {
          await tx.order.update({
            where: { id: paymentAttempt.order.id },
            data: { paymentStatus: targetStatus },
          });
        }

        return {
          message: `Payment attempt marked as ${targetStatus}`,
          orderCode: paymentAttempt.order.orderCode,
          gatewayOrderId: order_id,
        };
      }

      return {
        message: 'Payment status remains pending',
        orderCode: paymentAttempt.order.orderCode,
        gatewayOrderId: order_id,
      };
    });

    console.info('[MidtransWebhook] transaction committed', {
      orderId: result.gatewayOrderId,
      orderCode: result.orderCode,
      message: result.message,
      isIdempotent: result.isIdempotent === true,
    });

    return result;
  }
}

export const paymentService = new PaymentService();
