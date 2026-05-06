import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  cartExpirationHours: 24,
  taxRate: 0.08,
  shippingBase: 5.00,
  shippingPerItem: 2.00,
} as const;
