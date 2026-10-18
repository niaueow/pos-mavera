import { Request, Response, NextFunction } from 'express';
import { orderStatusService } from '../services/orderStatus.service';
import { sendSuccess } from '../utils/response';
import { OrderStatus } from '@prisma/client';
import { UpdateOrderStatusInput } from '../validators/auth.validator';

export class InternalOrderController {
  async getActiveOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const statusFilter = req.query.status as OrderStatus | undefined;
      const orders = await orderStatusService.getActiveOrders(statusFilter);
      sendSuccess(res, orders, 'Pesanan aktif berhasil diambil', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = Number(req.params.order_id);
      const { status, reason } = req.body as UpdateOrderStatusInput;
      const actor = req.user?.email || 'STAFF';

      const updated = await orderStatusService.updateOrderStatus(orderId, status, actor, reason);
      sendSuccess(res, updated, 'Status pesanan berhasil diperbarui', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const internalOrderController = new InternalOrderController();
