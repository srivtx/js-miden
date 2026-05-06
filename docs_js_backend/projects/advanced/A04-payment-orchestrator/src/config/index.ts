import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  STRIPE_WEBHOOK_SECRET: z.string().default('whsec_test'),
  PAYPAL_WEBHOOK_SECRET: z.string().default('whsec_paypal_test'),
  PRIMARY_PROVIDER: z.enum(['stripe', 'paypal']).default('stripe'),
  FALLBACK_ENABLED: z.string().default('true'),
  CIRCUIT_BREAKER_THRESHOLD: z.string().default('5'),
  CIRCUIT_BREAKER_TIMEOUT: z.string().default('30000'),
});

export type Env = z.infer<typeof envSchema>;

export const config = envSchema.parse(process.env);

export const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: parseInt(config.CIRCUIT_BREAKER_THRESHOLD, 10),
  resetTimeoutMs: parseInt(config.CIRCUIT_BREAKER_TIMEOUT, 10),
};
