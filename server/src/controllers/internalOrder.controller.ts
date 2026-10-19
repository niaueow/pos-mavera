import { Request, Response, NextFunction } from 'express';
import { orderStatusService } from '../services/orderStatus.service';
import { sendSuccess } from '../utils/response';
import { GetStaffOrdersQuery, UpdateOrderStatusInput } from '../validators/auth.validator';

export class InternalOrderController {
  async getActiveOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as GetStaffOrdersQuery;
      const orders = await orderStatusService.getActiveOrders({
        status: query.status,
        today: query.today,
        order_type: query.order_type,
      });
      sendSuccess(res, orders, 'Pesanan aktif berhasil diambil', 200);
    } catch (error) {
      next(error);
    }
  }

  async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = Number(req.params.id ?? req.params.order_id);
      const order = await orderStatusService.getOrderById(orderId);
      sendSuccess(res, order, 'Detail pesanan berhasil diambil', 200);
    } catch (error) {
      next(error);
    }
  }

  async updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderId = Number(req.params.id ?? req.params.order_id);
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

