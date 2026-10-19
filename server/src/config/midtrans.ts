import midtransClient from 'midtrans-client';
import { env, getMidtransConfigDiagnostics } from './env';

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
  const diagnostics = getMidtransConfigDiagnostics();
  const isPlaceholder =
    env.MIDTRANS_SERVER_KEY.includes('REPLACE_WITH_YOUR_KEY') ||
    env.MIDTRANS_SERVER_KEY.includes('placeholder') ||
    env.MIDTRANS_CLIENT_KEY.includes('REPLACE_WITH_YOUR_KEY') ||
    env.MIDTRANS_CLIENT_KEY.includes('placeholder');

  if (
    env.NODE_ENV !== 'test' &&
    (isPlaceholder ||
      !diagnostics.serverKey.configured ||
      !diagnostics.clientKey.configured)
  ) {
    throw new Error('Midtrans payment configuration is missing or invalid');
  }
}

export function logMidtransConfigDiagnostics(): void {
  const diagnostics = getMidtransConfigDiagnostics();
  console.info('[Midtrans] configuration', {
    environment: diagnostics.environment,
    source: diagnostics.source,
    loadedEnvFiles: diagnostics.loadedEnvFiles,
    serverKey: diagnostics.serverKey,
    clientKey: diagnostics.clientKey,
  });
}

export default snap;
