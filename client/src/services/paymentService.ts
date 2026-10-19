import { apiRequest } from './apiClient';
import { PaymentAttemptData } from '../types/midtrans';

/**
 * Calls POST /api/v1/orders/:orderCode/payment-attempts
 * to create or retrieve an active Midtrans Snap payment token for the given orderCode.
 */
export async function createPaymentAttempt(orderCode: string): Promise<PaymentAttemptData> {
  const cleanOrderCode = encodeURIComponent(orderCode.trim());
  const response = await apiRequest<PaymentAttemptData>(`/orders/${cleanOrderCode}/payment-attempts`, {
    method: 'POST',
  });

  return response.data;
}
