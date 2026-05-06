import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  BM25_K1: z.string().default('1.2'),
  BM25_B: z.string().default('0.75'),
});

export type Env = z.infer<typeof envSchema>;

export const config = envSchema.parse(process.env);

export const BM25_PARAMS = {
  k1: parseFloat(config.BM25_K1),
  b: parseFloat(config.BM25_B),
};
