import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_SSL: z
    .string()
    .optional()
    .transform((val) => val === 'true'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@aarnex.com'),
  SEED_ADMIN_PASSWORD: z.string().default('Admin@123456'),
  SEED_DEFAULT_USER_PASSWORD: z.string().default('User@123456'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // In test environment, provide fallback dummy DATABASE_URL if missing
  if (process.env.NODE_ENV === 'test') {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aarnex_test';
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_jwt_access_secret_32_characters_min';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_32_characters_min';
  } else {
    console.error('Invalid environment configuration:', parsed.error.format());
    // Provide sensible default in dev to prevent hard crash if .env is missing yet
  }
}

export const env = parsed.success
  ? parsed.data
  : envSchema.parse({
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aarnex_db',
      JWT_ACCESS_SECRET:
        process.env.JWT_ACCESS_SECRET || 'default_jwt_access_secret_32_characters_min',
      JWT_REFRESH_SECRET:
        process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_32_characters_min',
    });
