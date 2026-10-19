import midtransClient from 'midtrans-client';
import { env } from './env';

/**
 * Midtrans Snap Client initialization
 * - Uses MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY from validated environment variables.
 * - Sets environment to Sandbox unless MIDTRANS_IS_PRODUCTION is explicitly set to true.
 */
export const snap = new midtransClient.Snap({
  isProduction: env.MIDTRANS_IS_PRODUCTION === true,
  serverKey: env.MIDTRANS_SERVER_KEY,
  clientKey: env.MIDTRANS_CLIENT_KEY,
});

export function assertMidtransConfigured(): void {
  const isPlaceholder =
    env.MIDTRANS_SERVER_KEY.includes('REPLACE_WITH_YOUR_KEY') ||
    env.MIDTRANS_SERVER_KEY.includes('placeholder') ||
    env.MIDTRANS_CLIENT_KEY.includes('REPLACE_WITH_YOUR_KEY') ||
    env.MIDTRANS_CLIENT_KEY.includes('placeholder');

  if (env.NODE_ENV !== 'test' && (isPlaceholder || env.MIDTRANS_SERVER_KEY.trim() === '' || env.MIDTRANS_CLIENT_KEY.trim() === '')) {
    throw new Error('Midtrans payment configuration is missing or invalid');
  }
}

export default snap;
