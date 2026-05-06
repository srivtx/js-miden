export const config = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5439/socialfeed',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  port: parseInt(process.env.PORT || '3000'),
  feedLimit: 20,
  celebrityThreshold: 1000000,
};
