import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate';
import { validateOrderStatusTransition } from '../middlewares/orderTransition';
import {
  updateOrderStatusSchema,
  orderIdParamSchema,
  getStaffOrdersQuerySchema,
} from '../validators/auth.validator';
import { internalOrderController } from '../controllers/internalOrder.controller';

const router = Router();

// All /internal routes require authentication
router.use(authenticate);

// GET /internal/orders — Active orders for kitchen display (STAFF and ADMIN)
router.get(
  '/orders',
  authorize([UserRole.STAFF, UserRole.ADMIN, UserRole.OWNER]),
  validateQuery(getStaffOrdersQuerySchema),
  (req, res, next) => internalOrderController.getActiveOrders(req, res, next)
);

// GET /internal/orders/:order_id — Order details with items and status logs
router.get(
  '/orders/:order_id',
  authorize([UserRole.STAFF, UserRole.ADMIN, UserRole.OWNER]),
  validateParams(orderIdParamSchema),
  (req, res, next) => internalOrderController.getOrderById(req, res, next)
);

// PATCH /internal/orders/:order_id/status — Staff-driven transition (STAFF and ADMIN)
router.patch(
  '/orders/:order_id/status',
  authorize([UserRole.STAFF, UserRole.ADMIN, UserRole.OWNER]),
  validateParams(orderIdParamSchema),
  validateBody(updateOrderStatusSchema),
  validateOrderStatusTransition,
  (req, res, next) => internalOrderController.updateOrderStatus(req, res, next)
);

export default router;

