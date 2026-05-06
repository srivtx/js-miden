import { PrismaClient } from '@prisma/client';

export interface Config {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  eventualConsistencyTimeoutMs: number;
  snapshotFrequency: number;
  commandTimeoutMs: number;
  readModelCacheTtlMs: number;
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
  port: getEnvVarInt('PORT', 3001),
  databaseUrl: getEnvVar('DATABASE_URL'),
  eventualConsistencyTimeoutMs: getEnvVarInt('EVENTUAL_CONSISTENCY_TIMEOUT_MS', 5000),
  snapshotFrequency: getEnvVarInt('SNAPSHOT_FREQUENCY', 100),
  commandTimeoutMs: getEnvVarInt('COMMAND_TIMEOUT_MS', 30000),
  readModelCacheTtlMs: getEnvVarInt('READ_MODEL_CACHE_TTL_MS', 60000),
};

export const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});