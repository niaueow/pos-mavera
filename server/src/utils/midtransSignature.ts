import crypto from 'crypto';
import { env } from '../config/env';

export interface VerifySignatureParams {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
  serverKey?: string;
}

/**
 * Computes SHA512 hash according to Midtrans specification:
 * SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export function generateMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string = env.MIDTRANS_SERVER_KEY
): string {
  const rawString = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  return crypto.createHash('sha512').update(rawString).digest('hex');
}

/**
 * Verifies if incoming signature_key matches calculated SHA512 hash in constant time
 */
export function verifyMidtransSignature({
  orderId,
  statusCode,
  grossAmount,
  signatureKey,
  serverKey = env.MIDTRANS_SERVER_KEY,
}: VerifySignatureParams): boolean {
  if (!orderId || !statusCode || !grossAmount || !signatureKey) {
    return false;
  }

  const expectedSignature = generateMidtransSignature(orderId, statusCode, grossAmount, serverKey);
  
  if (expectedSignature.length !== signatureKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'utf-8'),
    Buffer.from(signatureKey, 'utf-8')
  );
}
