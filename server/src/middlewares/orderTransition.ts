import { Request, Response, NextFunction } from 'express';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from './errorHandler';
import { assertValidOrderStatusTransition } from '../services/orderStatus.service';

/**
 * Middleware that validates whether the requested order status transition is logical and permitted.
 * Ensures:
 * 1. The order exists (404 NOT_FOUND otherwise).
 * 2. The order is PAID (422 UNPAID_ORDER otherwise).
 * 3. The order is not already in a terminal state (409 TERMINAL_STATE).
 * 4. The target status is not a duplicate of the current status (409 DUPLICATE_STATUS).
 * 5. The transition moves strictly 1 step forward:
 *    RECEIVED ("Pesanan Diterima") -> PREPARING ("Sedang Dimasak") -> READY ("Pesanan Siap Diambil") -> COMPLETED ("Selesai")
 *    Backward or skipped transitions are rejected with 409 INVALID_STATE_TRANSITION.
 */
export async function validateOrderStatusTransition(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawOrderId = req.params.id ?? req.params.order_id;
    const orderId = Number(rawOrderId);
    const targetStatus = req.body.status as OrderStatus;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderStatus: true,
        paymentStatus: true,
      },
    });

    if (!order) {
      throw new AppError(404, 'NOT_FOUND', `Pesanan dengan ID ${orderId} tidak ditemukan`);
    }

    assertValidOrderStatusTransition(order, targetStatus);

    next();
  } catch (error) {
    next(error);
  }
}
