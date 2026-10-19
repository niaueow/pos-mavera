import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { validateBody } from '../middlewares/validate';
import { orderCreationRateLimiter } from '../middlewares/rateLimiter';
import { createOrderSchema } from '../validators/order.validator';

import { requireTrackingToken } from '../middlewares/trackingAuth';

const router = Router();

/**
 * @route   POST /api/v1/orders
 * @desc    Create a guest order (Dine-in or Takeaway) with server-side price calculation
 * @access  Public (Rate-limited)
 */
router.post(
  '/',
  orderCreationRateLimiter,
  validateBody(createOrderSchema),
  (req, res, next) => orderController.createOrder(req, res, next)
);

/**
 * @route   GET /api/v1/orders/:orderCode
 * @desc    Track guest order status protected by X-Order-Tracking-Token header
 * @access  Public (Protected by X-Order-Tracking-Token)
 */
router.get(
  '/:orderCode',
  requireTrackingToken,
  (req, res, next) => orderController.trackOrder(req, res, next)
);

export default router;
