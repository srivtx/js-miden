export const config = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5411/trading',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6311',
  port: parseInt(process.env.PORT || '3000'),
  defaultTickSize: 0.01,
};
