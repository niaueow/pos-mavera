import { afterEach, describe, expect, it } from 'vitest';
import { assertMidtransConfigured } from '../src/config/midtrans';
import { env } from '../src/config/env';

const originalConfig = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.MIDTRANS_IS_PRODUCTION,
  serverKey: env.MIDTRANS_SERVER_KEY,
  clientKey: env.MIDTRANS_CLIENT_KEY,
};

afterEach(() => {
  env.NODE_ENV = originalConfig.nodeEnv;
  env.MIDTRANS_IS_PRODUCTION = originalConfig.isProduction;
  env.MIDTRANS_SERVER_KEY = originalConfig.serverKey;
  env.MIDTRANS_CLIENT_KEY = originalConfig.clientKey;
});

describe('Midtrans configuration validation', () => {
  it('accepts Sandbox keys issued without an SB prefix', () => {
    env.NODE_ENV = 'development';
    env.MIDTRANS_IS_PRODUCTION = false;
    env.MIDTRANS_SERVER_KEY = 'Mid-server-sandbox-test-key';
    env.MIDTRANS_CLIENT_KEY = 'Mid-client-sandbox-test-key';

    expect(() => assertMidtransConfigured()).not.toThrow();
  });

  it('rejects missing keys', () => {
    env.NODE_ENV = 'development';
    env.MIDTRANS_SERVER_KEY = '';
    env.MIDTRANS_CLIENT_KEY = '';

    expect(() => assertMidtransConfigured()).toThrow(
      'Midtrans payment configuration is missing or invalid',
    );
  });

  it('rejects placeholder keys', () => {
    env.NODE_ENV = 'development';
    env.MIDTRANS_SERVER_KEY = 'Mid-server-REPLACE_WITH_YOUR_KEY';
    env.MIDTRANS_CLIENT_KEY = 'Mid-client-placeholder';

    expect(() => assertMidtransConfigured()).toThrow(
      'Midtrans payment configuration is missing or invalid',
    );
  });

  it('accepts Production keys without the Sandbox prefix', () => {
    env.NODE_ENV = 'development';
    env.MIDTRANS_IS_PRODUCTION = true;
    env.MIDTRANS_SERVER_KEY = 'Mid-server-production-test-key';
    env.MIDTRANS_CLIENT_KEY = 'Mid-client-production-test-key';

    expect(() => assertMidtransConfigured()).not.toThrow();
  });
});
