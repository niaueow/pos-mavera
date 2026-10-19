import { Request, Response, NextFunction } from 'express';
import { PaymentStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { snap } from '../config/midtrans';
import { sendSuccess } from '../utils/response';
import { AppError } from '../middlewares/errorHandler';

import { paymentService } from '../services/payment.service';

export interface PaymentAttemptResponseData {
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

      // Cari data order di database menggunakan Prisma, include relasi items dan paymentAttempts
      const order = await prisma.order.findUnique({
        where: { orderCode: trimmedOrderCode },
        include: {
          items: true,
          paymentAttempts: true,
        },
      });

      // Jika order tidak ditemukan, kembalikan HTTP 404
      if (!order) {
        throw new AppError(404, 'NOT_FOUND', `Pesanan dengan kode ${trimmedOrderCode} tidak ditemukan`);
      }

      // Jika order.paymentStatus === 'PAID', kembalikan HTTP 409 (Conflict)
      if (order.paymentStatus === PaymentStatus.PAID) {
        throw new AppError(409, 'CONFLICT', 'Pesanan ini sudah berhasil dibayar');
      }

      // Mekanisme Idempotensi: Cek apakah sudah ada paymentAttempt dengan status === 'PENDING' yang belum kadaluarsa (expiresAt > now)
      const now = new Date();
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

      // Pembuatan Payment Attempt Baru:
      // Hitung nextAttemptNumber = order.paymentAttempts.length + 1
      const nextAttemptNumber = order.paymentAttempts.length + 1;
      // Buat gatewayOrderId unik dengan format ${order.orderCode}-${nextAttemptNumber}
      const gatewayOrderId = `${order.orderCode}-${nextAttemptNumber}`;

      // Tentukan waktu kadaluarsa expiresAt (15 menit dari sekarang)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // Panggil snap.createTransaction() dengan payload
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

      let snapResponse: { token: string; redirect_url: string };
      try {
        snapResponse = await (snap.createTransaction as any)(snapPayload);
      } catch (midtransError: any) {
        console.error(
          `[PaymentController] Midtrans snap.createTransaction failed for order ${order.orderCode} (${gatewayOrderId}):`,
          midtransError?.message || midtransError
        );
        throw new AppError(
          502,
          'PAYMENT_GATEWAY_ERROR',
          `Gagal menghubungi payment gateway Midtrans: ${midtransError?.message || 'Unknown error'}`
        );
      }

      if (!snapResponse || !snapResponse.token || !snapResponse.redirect_url) {
        console.error('[PaymentController] Midtrans snap.createTransaction returned invalid response payload:', snapResponse);
        throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'Respon dari payment gateway Midtrans tidak valid');
      }

      // Simpan rekaman PaymentAttempt baru ke database menggunakan Prisma
      const newAttempt = await prisma.paymentAttempt.create({
        data: {
          orderId: order.id,
          gatewayOrderId,
          snapToken: snapResponse.token,
          snapRedirectUrl: snapResponse.redirect_url,
          grossAmount: order.totalAmount,
          status: PaymentStatus.PENDING,
          expiresAt,
        },
      });

      // Kembalikan response JSON HTTP 201 berisi orderCode, gatewayOrderId, snapToken, snapRedirectUrl, dan expiresAt
      sendSuccess<PaymentAttemptResponseData>(
        res,
        {
          orderCode: order.orderCode,
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
