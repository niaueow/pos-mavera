import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth';
import { validateBody, validateParams } from '../middlewares/validate';
import { updateOrderStatusSchema, orderIdParamSchema } from '../validators/auth.validator';
import { internalOrderController } from '../controllers/internalOrder.controller';

const router = Router();

// All /internal routes require authentication
router.use(authenticate);

// GET /internal/orders — Active orders for kitchen display (STAFF and ADMIN)
router.get(
  '/orders',
  authorize([UserRole.STAFF, UserRole.ADMIN, UserRole.OWNER]),
  (req, res, next) => internalOrderController.getActiveOrders(req, res, next)
);

// PATCH /internal/orders/:order_id/status — Staff-driven transition (STAFF and ADMIN)
router.patch(
  '/orders/:order_id/status',
  authorize([UserRole.STAFF, UserRole.ADMIN, UserRole.OWNER]),
  validateParams(orderIdParamSchema),
  validateBody(updateOrderStatusSchema),
  (req, res, next) => internalOrderController.updateOrderStatus(req, res, next)
);

export default router;
