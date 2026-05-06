import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export interface Config {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  aggregationWindowMs: number;
  metricsRetentionHours: number;
  rateLimitRps: number;
  eventBatchSize: number;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvVarInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer`);
  }
  return parsed;
}

export const config: Config = {
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  port: getEnvVarInt('PORT', 3000),
  databaseUrl: getEnvVar('DATABASE_URL'),
  redisUrl: getEnvVar('REDIS_URL'),
  aggregationWindowMs: getEnvVarInt('AGGREGATION_WINDOW_MS', 60000),
  metricsRetentionHours: getEnvVarInt('METRICS_RETENTION_HOURS', 24),
  rateLimitRps: getEnvVarInt('RATE_LIMIT_RPS', 10000),
  eventBatchSize: getEnvVarInt('EVENT_BATCH_SIZE', 100),
};

export const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});