import { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { sendSuccess } from '../utils/response';
import { CreateOrderInput } from '../validators/order.validator';

export class OrderController {
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body as CreateOrderInput;
      const result = await orderService.createOrder(payload);

      sendSuccess(res, result, 'Order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async trackOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orderCode = Array.isArray(req.params.orderCode) ? req.params.orderCode[0] : req.params.orderCode;
      const rawHeader = req.headers['x-order-tracking-token'];
      const trackingToken: string =
        typeof req.trackingToken === 'string'
          ? req.trackingToken
          : Array.isArray(rawHeader)
          ? (rawHeader[0] ?? '')
          : typeof rawHeader === 'string'
          ? rawHeader
          : '';
      const result = await orderService.trackOrder(orderCode, trackingToken);

      sendSuccess(res, result, 'Data pelacakan pesanan berhasil diambil', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const orderController = new OrderController();
