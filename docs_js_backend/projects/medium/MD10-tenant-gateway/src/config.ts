export const config = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5440/tenantgateway',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6380',
  port: parseInt(process.env.PORT || '3000'),
  defaultRateLimit: 100,
};
