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

export default snap;
