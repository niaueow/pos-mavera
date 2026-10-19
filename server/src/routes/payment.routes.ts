import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';

const router = Router();

/**
 * @route   POST /api/v1/orders/:orderCode/payment-attempts
 * @desc    Create or retrieve an active Midtrans Snap payment attempt for an order
 * @access  Public (No JWT authentication required)
 */
router.post('/orders/:orderCode/payment-attempts', (req, res, next) => {
  paymentController.createPaymentAttempt(req, res, next);
});

export default router;
