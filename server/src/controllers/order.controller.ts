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
}

export const orderController = new OrderController();
