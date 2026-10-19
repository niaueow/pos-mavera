import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate';
import { validateOrderStatusTransition } from '../middlewares/orderTransition';
import {
  updateOrderStatusSchema,
  staffOrderIdParamSchema,
  getStaffOrdersQuerySchema,
} from '../validators/auth.validator';
import { internalOrderController } from '../controllers/internalOrder.controller';

const router = Router();

// All /api/v1/staff routes require JWT authentication and RBAC authorization (STAFF / ADMIN / OWNER)
router.use(authenticate);
router.use(authorize([UserRole.STAFF, UserRole.ADMIN, UserRole.OWNER]));

/**
 * @route   GET /api/v1/staff/orders
 * @desc    List active/unfinished orders for cashier/kitchen staff (supports ?status=, ?today=true, ?order_type=)
 * @access  Protected (STAFF, ADMIN, OWNER)
 */
router.get(
  '/orders',
  validateQuery(getStaffOrdersQuerySchema),
  (req, res, next) => internalOrderController.getActiveOrders(req, res, next)
);

/**
 * @route   GET /api/v1/staff/orders/:id
 * @desc    Get full order details including order items and status change audit logs
 * @access  Protected (STAFF, ADMIN, OWNER)
 */
router.get(
  '/orders/:id',
  validateParams(staffOrderIdParamSchema),
  (req, res, next) => internalOrderController.getOrderById(req, res, next)
);

/**
 * @route   PATCH /api/v1/staff/orders/:id/status
 * @desc    Update order fulfillment status with strict forward-only transition validation
 * @access  Protected (STAFF, ADMIN, OWNER)
 */
router.patch(
  '/orders/:id/status',
  validateParams(staffOrderIdParamSchema),
  validateBody(updateOrderStatusSchema),
  validateOrderStatusTransition,
  (req, res, next) => internalOrderController.updateOrderStatus(req, res, next)
);

export default router;
