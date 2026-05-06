export const config = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5431/fhir',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6331',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-bytes!!',
  port: parseInt(process.env.PORT || '3000'),
};
