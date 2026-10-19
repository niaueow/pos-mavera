import { Request, Response, NextFunction } from 'express';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { assertMidtransConfigured, snap } from '../config/midtrans';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middlewares/errorHandler';
import { verifyTrackingToken } from '../utils/trackingToken';

import { paymentService } from '../services/payment.service';

interface MidtransGatewayError {
  httpStatusCode?: number | null;
  ApiResponse?: unknown;
}

function isDefinitiveGatewayFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const statusCode = (error as MidtransGatewayError).httpStatusCode;
  return statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 422;
}

export interface PaymentAttemptResponseData {
  paymentAttemptId: number;
  orderCode: string;
  gatewayOrderId: string;
  snapToken: string;
  snapRedirectUrl: string;
  expiresAt: Date | string;
}

export class PaymentController {
  async createPaymentAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderCode } = req.params;

      if (!orderCode || typeof orderCode !== 'string' || orderCode.trim() === '') {
        throw new AppError(400, 'BAD_REQUEST', 'Parameter orderCode diperlukan');
      }

      const trimmedOrderCode = orderCode.trim();
      const trackingToken = req.trackingToken;

      const order = await prisma.order.findUnique({
        where: { orderCode: trimmedOrderCode },
        include: {
          items: true,
          paymentAttempts: true,
        },
      });

      if (!order) {
        throw new AppError(404, 'NOT_FOUND', `Pesanan dengan kode ${trimmedOrderCode} tidak ditemukan`);
      }

      if (!trackingToken || !verifyTrackingToken(trackingToken, order.trackingTokenHash)) {
        throw new AppError(401, 'UNAUTHORIZED', 'Token pelacakan tidak valid');
      }

      if (order.paymentStatus === PaymentStatus.PAID) {
        throw new AppError(409, 'CONFLICT', 'Pesanan ini sudah berhasil dibayar');
      }
      if (order.orderStatus !== OrderStatus.PENDING_PAYMENT) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Pesanan tidak lagi dapat dibayar');
      }

      try {
        assertMidtransConfigured();
      } catch {
        throw new AppError(503, 'PAYMENT_CONFIGURATION_ERROR', 'Payment gateway belum dikonfigurasi');
      }

      const calculatedAmount = order.items.reduce((total, item) => total + item.subtotal, 0);
      if (calculatedAmount !== order.totalAmount) {
        throw new AppError(500, 'DATA_INTEGRITY_ERROR', 'Total pesanan tersimpan tidak konsisten');
      }

      // Mekanisme Idempotensi: Cek apakah sudah ada paymentAttempt dengan status === 'PENDING' yang belum kadaluarsa (expiresAt > now)
      const now = new Date();
      const unresolvedAttempt = order.paymentAttempts.find(
        (attempt) =>
          attempt.status === PaymentStatus.PENDING &&
          new Date(attempt.expiresAt) > now &&
          (!attempt.snapToken || !attempt.snapRedirectUrl)
      );
      if (unresolvedAttempt) {
        throw new AppError(
          502,
          'PAYMENT_GATEWAY_ERROR',
          'Percobaan pembayaran sebelumnya belum dapat dikonfirmasi; silakan coba lagi setelah rekonsiliasi'
        );
      }

      const activeAttempt = order.paymentAttempts
        .filter(
          (attempt) =>
            attempt.status === PaymentStatus.PENDING &&
            new Date(attempt.expiresAt) > now &&
            Boolean(attempt.snapToken) &&
            Boolean(attempt.snapRedirectUrl)
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      // Jika ada attempt PENDING yang aktif, langsung kembalikan data snapToken dan snapRedirectUrl dari attempt tersebut (HTTP 200)
      if (activeAttempt && activeAttempt.snapToken && activeAttempt.snapRedirectUrl) {
        sendSuccess<PaymentAttemptResponseData>(
          res,
          {
            paymentAttemptId: activeAttempt.id,
            orderCode: order.orderCode,
            gatewayOrderId: activeAttempt.gatewayOrderId,
            snapToken: activeAttempt.snapToken,
            snapRedirectUrl: activeAttempt.snapRedirectUrl,
            expiresAt: activeAttempt.expiresAt,
          },
          'Payment attempt aktif ditemukan',
          200
        );
        return;
      }

      const gatewayOrderId = `${order.orderCode}-${order.paymentAttempts.length + 1}`;

      // Tentukan waktu kadaluarsa expiresAt (15 menit dari sekarang)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      const itemDetails = order.items.map((item) => ({
        id: String(item.id),
        price: item.unitPrice,
        quantity: item.quantity,
        name: item.menuName,
      }));

      const snapPayload = {
        transaction_details: {
          order_id: gatewayOrderId,
          gross_amount: order.totalAmount,
        },
        item_details: itemDetails,
        customer_details: {
          first_name: order.customerName,
          phone: order.customerPhone,
        },
        expiry: {
          unit: 'minutes',
          duration: 15,
        },
      };

      const reservedAttempt = await prisma.paymentAttempt.create({
        data: {
          orderId: order.id,
          gatewayOrderId,
          grossAmount: calculatedAmount,
          status: PaymentStatus.PENDING,
          expiresAt,
        },
      });

      let snapResponse: { token: string; redirect_url: string };
      try {
        snapResponse = await snap.createTransaction(snapPayload);
      } catch (midtransError: unknown) {
        const message = midtransError instanceof Error ? midtransError.message : 'Unknown error';
        const definitiveFailure = isDefinitiveGatewayFailure(midtransError);
        console.error(
          `[PaymentController] Midtrans snap.createTransaction failed for order ${order.orderCode} (${gatewayOrderId}):`,
          message,
          definitiveFailure ? 'definitive' : 'ambiguous'
        );
        await prisma.paymentAttempt.update({
          where: { id: reservedAttempt.id },
          data: {
            gatewayTransactionStatus: definitiveFailure
              ? 'creation_failed_definitive'
              : 'creation_failed_ambiguous',
            ...(definitiveFailure
              ? { status: PaymentStatus.FAILED, expiresAt: new Date() }
              : {}),
          },
        });
        throw new AppError(
          502,
          'PAYMENT_GATEWAY_ERROR',
          'Gagal menghubungi payment gateway Midtrans'
        );
      }

      if (!snapResponse || !snapResponse.token || !snapResponse.redirect_url) {
        console.error('[PaymentController] Midtrans snap.createTransaction returned invalid response payload:', snapResponse);
        throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'Respon dari payment gateway Midtrans tidak valid');
      }

      const newAttempt = await prisma.paymentAttempt.update({
        where: { id: reservedAttempt.id },
        data: {
          snapToken: snapResponse.token,
          snapRedirectUrl: snapResponse.redirect_url,
        },
      });

      // Kembalikan response JSON HTTP 201 berisi orderCode, gatewayOrderId, snapToken, snapRedirectUrl, dan expiresAt
      sendSuccess<PaymentAttemptResponseData>(
        res,
        {
          orderCode: order.orderCode,
          paymentAttemptId: newAttempt.id,
          gatewayOrderId: newAttempt.gatewayOrderId,
          snapToken: newAttempt.snapToken!,
          snapRedirectUrl: newAttempt.snapRedirectUrl!,
          expiresAt: newAttempt.expiresAt,
        },
        'Payment attempt berhasil dibuat',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle webhook notification from Midtrans
   */
  async handleNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await paymentService.processNotification(req.body);
      sendSuccess(res, result, result.message, 200);
    } catch (error) {
      next(error);
    }
  }
}

export const paymentController = new PaymentController();
