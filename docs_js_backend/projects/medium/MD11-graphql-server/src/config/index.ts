import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

export interface Config {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  queryDepthLimit: number;
  queryComplexityLimit: number;
  persistedQueries: boolean;
  subscriptionEnabled: boolean;
  apolloIntrospection: boolean;
  apolloPlayground: boolean;
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

function getEnvVarBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export const config: Config = {
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  port: getEnvVarInt('PORT', 4000),
  databaseUrl: getEnvVar('DATABASE_URL'),
  redisUrl: getEnvVar('REDIS_URL'),
  jwtSecret: getEnvVar('JWT_SECRET', 'dev-secret'),
  queryDepthLimit: getEnvVarInt('QUERY_DEPTH_LIMIT', 10),
  queryComplexityLimit: getEnvVarInt('QUERY_COMPLEXITY_LIMIT', 1000),
  persistedQueries: getEnvVarBool('PERSISTED_QUERIES', true),
  subscriptionEnabled: getEnvVarBool('SUBSCRIPTION_ENABLED', true),
  apolloIntrospection: getEnvVarBool('APOLLO_INTROSPECTION', false),
  apolloPlayground: getEnvVarBool('APOLLO_PLAYGROUND', false),
};

export const prisma = new PrismaClient({
  log: config.nodeEnv === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected');
});