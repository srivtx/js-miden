import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://ledger:ledger@localhost:5432/ledger',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  auditLogPath: process.env.AUDIT_LOG_PATH || './data/audit',
  defaultCurrency: 'USD',
  supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'BTC'],
  precision: 8,
};
