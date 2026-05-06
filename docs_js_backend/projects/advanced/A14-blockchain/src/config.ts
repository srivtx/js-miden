export const config = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5441/blockchain',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6341',
  port: parseInt(process.env.PORT || '3000'),
  chainId: '1337',
};
