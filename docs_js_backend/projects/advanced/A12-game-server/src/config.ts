export const config = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5421/gameserver',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6321',
  port: parseInt(process.env.PORT || '3000'),
  maxSkillGap: 200,
};
