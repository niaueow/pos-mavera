import { OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middlewares/errorHandler';
import { verifyMidtransSignature } from '../utils/midtransSignature';

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
  [key: string]: any;
}

export interface ProcessNotificationResult {
  message: string;
  orderCode: string;
  gatewayOrderId: string;
  isIdempotent?: boolean;
}

export class PaymentService {
  /**
   * Process incoming Midtrans webhook notification.
   * Handles signature verification, idempotency, and transactional order/attempt status updates.
   */
  async processNotification(payload: MidtransNotificationPayload): Promise<ProcessNotificationResult> {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      transaction_id,
      payment_type,
    } = payload;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
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
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid Midtrans signature key');
    }

    // 2. Parse order_id (format: <orderCode>-<attemptNumber>)
    const lastHyphenIndex = order_id.lastIndexOf('-');
    const orderCode = lastHyphenIndex !== -1 ? order_id.substring(0, lastHyphenIndex) : order_id;

    // 3. Eksekusi database update via Prisma $transaction
    return await prisma.$transaction(async (tx) => {
      // Cari PaymentAttempt berdasarkan gatewayOrderId (order_id)
      const paymentAttempt = await tx.paymentAttempt.findUnique({
        where: { gatewayOrderId: order_id },
        include: { order: true },
      });

      let order = paymentAttempt?.order ?? null;
      if (!order) {
        order = await tx.order.findUnique({
          where: { orderCode },
        });
      }

      if (!order || !paymentAttempt) {
        throw new AppError(
          404,
          'NOT_FOUND',
          `Pesanan atau data pembayaran dengan order_id ${order_id} tidak ditemukan`
        );
      }

      // 4. Penanganan Idempotensi:
      // Jika pesanan sudah berstatus PAID, jangan lakukan modifikasi ulang dan kembalikan 200 OK
      if (order.paymentStatus === PaymentStatus.PAID) {
        return {
          message: 'Already processed',
          orderCode: order.orderCode,
          gatewayOrderId: order_id,
          isIdempotent: true,
        };
      }

      // 5. Logika Transisi Status berdasarkan transaction_status & fraud_status
      const isSettlement = transaction_status === 'settlement';
      const isCaptureAccept =
        transaction_status === 'capture' && (!fraud_status || fraud_status === 'accept');

      if (isSettlement || isCaptureAccept) {
        // Update PaymentAttempt -> PAID
        await tx.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: PaymentStatus.PAID,
            paidAt: new Date(),
            transactionId: transaction_id ?? paymentAttempt.transactionId,
            paymentType: payment_type ?? paymentAttempt.paymentType,
            gatewayTransactionStatus: transaction_status,
            gatewayFraudStatus: fraud_status ?? paymentAttempt.gatewayFraudStatus,
          },
        });

        // Update Order -> paymentStatus: PAID & orderStatus: RECEIVED (Pesanan Diterima)
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: PaymentStatus.PAID,
            orderStatus: OrderStatus.RECEIVED,
          },
        });

        // Catat ke OrderStatusLog jika status order berpindah ke RECEIVED
        if (order.orderStatus !== OrderStatus.RECEIVED) {
          await tx.orderStatusLog.create({
            data: {
              orderId: order.id,
              previousStatus: order.orderStatus,
              newStatus: OrderStatus.RECEIVED,
              changedBy: 'MIDTRANS_WEBHOOK',
              reason: `Pembayaran berhasil terverifikasi (${payment_type ?? 'midtrans'})`,
            },
          });
        }

        return {
          message: 'Payment confirmed successfully',
          orderCode: order.orderCode,
          gatewayOrderId: order_id,
        };
      } else if (
        transaction_status === 'cancel' ||
        transaction_status === 'deny' ||
        transaction_status === 'expire'
      ) {
        const targetAttemptStatus =
          transaction_status === 'expire'
            ? PaymentStatus.EXPIRED
            : transaction_status === 'cancel'
            ? PaymentStatus.CANCELLED
            : PaymentStatus.FAILED;

        await tx.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: targetAttemptStatus,
            transactionId: transaction_id ?? paymentAttempt.transactionId,
            paymentType: payment_type ?? paymentAttempt.paymentType,
            gatewayTransactionStatus: transaction_status,
            gatewayFraudStatus: fraud_status ?? paymentAttempt.gatewayFraudStatus,
          },
        });

        // Cek apakah masih ada attempt lain yang aktif
        const remainingActiveAttempts = await tx.paymentAttempt.count({
          where: {
            orderId: order.id,
            id: { not: paymentAttempt.id },
            status: PaymentStatus.PENDING,
            expiresAt: { gt: new Date() },
          },
        });

        // Jika tidak ada attempt aktif tersisa, update order.paymentStatus sesuai kondisi
        if (remainingActiveAttempts === 0) {
          await tx.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: targetAttemptStatus,
            },
          });
        }

        return {
          message: `Payment attempt marked as ${targetAttemptStatus}`,
          orderCode: order.orderCode,
          gatewayOrderId: order_id,
        };
      } else if (transaction_status === 'pending') {
        // Status tetap PENDING
        await tx.paymentAttempt.update({
          where: { id: paymentAttempt.id },
          data: {
            status: PaymentStatus.PENDING,
            transactionId: transaction_id ?? paymentAttempt.transactionId,
            paymentType: payment_type ?? paymentAttempt.paymentType,
            gatewayTransactionStatus: transaction_status,
            gatewayFraudStatus: fraud_status ?? paymentAttempt.gatewayFraudStatus,
          },
        });

        return {
          message: 'Payment status remains pending',
          orderCode: order.orderCode,
          gatewayOrderId: order_id,
        };
      }

      return {
        message: `Notification received with status ${transaction_status}`,
        orderCode: order.orderCode,
        gatewayOrderId: order_id,
      };
    });
  }
}

export const paymentService = new PaymentService();
