import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load .env from server directory or monorepo root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/pos_mavera?schema=public'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('dev_jwt_secret_change_in_production_min_32_characters_long'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  MIDTRANS_SERVER_KEY: z.string().default('SB-Mid-server-placeholder'),
  MIDTRANS_CLIENT_KEY: z.string().default('SB-Mid-client-placeholder'),
  MIDTRANS_IS_PRODUCTION: z.coerce.boolean().default(false),
  INITIAL_STAFF_EMAIL: z.string().email().default('staff@mavera.local'),
  INITIAL_STAFF_PASSWORD: z.string().default('StaffMavera123!'),
  INITIAL_ADMIN_EMAIL: z.string().email().default('admin@mavera.local'),
  INITIAL_ADMIN_PASSWORD: z.string().default('AdminMavera123!'),
});

export type Env = z.infer<typeof envSchema>;

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
  }

  return result.data;
}

export const env = validateEnv();
