import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  rateLimitShortenPerMinute: parseInt(process.env.RATE_LIMIT_SHORTEN_PER_MINUTE || '10', 10),
  rateLimitRedirectPerMinute: parseInt(process.env.RATE_LIMIT_REDIRECT_PER_MINUTE || '100', 10),
  cacheTtlSeconds: 3600,
  analyticsBatchSize: 100,
  defaultExpiryDays: 30,
} as const;
