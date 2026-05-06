export const config = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5431/auction',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6381',
  port: parseInt(process.env.PORT || '3000'),
  extensionWindowMs: 30000,
};
