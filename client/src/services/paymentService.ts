import { ApiClientError, apiRequest } from './apiClient';
import { PaymentAttemptData } from '../types/midtrans';

/**
 * Calls POST /api/v1/orders/:orderCode/payment-attempts
 * to create or retrieve an active Midtrans Snap payment token for the given orderCode.
 */
export async function createPaymentAttempt(
  orderCode: string,
  trackingToken: string
): Promise<PaymentAttemptData> {
  const cleanTrackingToken =
    typeof trackingToken === 'string' ? trackingToken.trim() : '';
  if (!cleanTrackingToken) {
    throw new ApiClientError(
      0,
      'MISSING_TRACKING_TOKEN',
      'Token pelacakan pesanan tidak tersedia. Silakan buat pesanan kembali.'
    );
  }

  const cleanOrderCode = encodeURIComponent(orderCode.trim());
  const response = await apiRequest<PaymentAttemptData>(`/orders/${cleanOrderCode}/payment-attempts`, {
    method: 'POST',
    headers: {
      'X-Order-Tracking-Token': cleanTrackingToken,
    },
  });

  return response.data;
}
