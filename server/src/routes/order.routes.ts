import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { validateBody } from '../middlewares/validate';
import { orderCreationRateLimiter } from '../middlewares/rateLimiter';
import { createOrderSchema } from '../validators/order.validator';

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

export default router;
