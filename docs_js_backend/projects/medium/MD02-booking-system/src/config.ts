import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  holdDurationMinutes: 15,
  cancellationPolicyHours: 24,
  defaultTimezone: 'UTC',
} as const;
