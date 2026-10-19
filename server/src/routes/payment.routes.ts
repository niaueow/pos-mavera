import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { requireTrackingToken } from '../middlewares/trackingAuth';

const router = Router();

/**
 * @route   POST /api/v1/orders/:orderCode/payment-attempts
 * @desc    Create or retrieve an active Midtrans Snap payment attempt for an order
 * @access  Public (No JWT authentication required)
 */
router.post(
  '/orders/:orderCode/payment-attempts',
  requireTrackingToken,
  (req, res, next) => paymentController.createPaymentAttempt(req, res, next)
);

/**
 * @route   POST /api/v1/payments/notification
 * @desc    Receive webhook notifications from Midtrans
 * @access  Public (Called by Midtrans backend / ngrok webhook)
 */
router.post('/payments/notification', (req, res, next) => {
  paymentController.handleNotification(req, res, next);
});

export default router;
