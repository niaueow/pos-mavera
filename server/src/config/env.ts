import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

const hadProcessMidtransConfig =
  typeof process.env.MIDTRANS_SERVER_KEY === 'string' ||
  typeof process.env.MIDTRANS_CLIENT_KEY === 'string';

const envFileCandidates = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(process.cwd(), '.env'),
];

const loadedEnvFiles = envFileCandidates.filter((envFile, index, candidates) => {
  if (candidates.indexOf(envFile) !== index) {
    return false;
  }
  return dotenv.config({ path: envFile }).parsed !== undefined;
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/pos_mavera?schema=public'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('dev_jwt_secret_change_in_production_min_32_characters_long'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  MIDTRANS_SERVER_KEY: z.string().default('SB-Mid-server-placeholder'),
  MIDTRANS_CLIENT_KEY: z.string().default('SB-Mid-client-placeholder'),
  MIDTRANS_IS_PRODUCTION: z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .default("false"),
  INITIAL_STAFF_EMAIL: z.string().email().default('staff@mavera.local'),
  INITIAL_STAFF_PASSWORD: z.string().default('StaffMavera123!'),
  INITIAL_ADMIN_EMAIL: z.string().email().default('admin@mavera.local'),
  INITIAL_ADMIN_PASSWORD: z.string().default('AdminMavera123!'),
});

export type Env = z.infer<typeof envSchema>;

export interface MidtransConfigDiagnostics {
  environment: 'sandbox' | 'production';
  serverKey: {
    configured: boolean;
    prefix: string;
    length: number;
  };
  clientKey: {
    configured: boolean;
    prefix: string;
    length: number;
  };
  loadedEnvFiles: string[];
  source: 'environment' | 'dotenv' | 'default';
}

function keyDiagnostics(value: string): MidtransConfigDiagnostics['serverKey'] {
  return {
    configured: value.trim() !== '' && !value.toLowerCase().includes('placeholder'),
    prefix: value.trim().slice(0, 12),
    length: value.length,
  };
}

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:', JSON.stringify(result.error.format(), null, 2));
    throw new Error('Environment configuration validation failed');
  }
  
  if (result.data.NODE_ENV === 'production') {
    if (result.data.DATABASE_URL.includes('postgres:postgres@localhost')) {
      throw new Error('DATABASE_URL must be configured with real credentials in production');
    }
    if (result.data.JWT_SECRET.includes('dev_jwt_secret')) {
      throw new Error('JWT_SECRET must be set to a secure random value in production');
    }
    if (
      result.data.MIDTRANS_SERVER_KEY.includes('REPLACE_WITH_YOUR_KEY') ||
      result.data.MIDTRANS_SERVER_KEY.includes('placeholder') ||
      result.data.MIDTRANS_CLIENT_KEY.includes('REPLACE_WITH_YOUR_KEY') ||
      result.data.MIDTRANS_CLIENT_KEY.includes('placeholder')
    ) {
      throw new Error('MIDTRANS credentials must be configured in production');
    }
  }

  return result.data;
}

export const env = validateEnv();

export function getMidtransConfigDiagnostics(): MidtransConfigDiagnostics {
  const serverKey = keyDiagnostics(env.MIDTRANS_SERVER_KEY);
  const clientKey = keyDiagnostics(env.MIDTRANS_CLIENT_KEY);
  const hasDotenvValue = loadedEnvFiles.length > 0;
  return {
    environment: env.MIDTRANS_IS_PRODUCTION ? 'production' : 'sandbox',
    serverKey,
    clientKey,
    loadedEnvFiles,
    source: hadProcessMidtransConfig ? 'environment' : hasDotenvValue ? 'dotenv' : 'default',
  };
}
