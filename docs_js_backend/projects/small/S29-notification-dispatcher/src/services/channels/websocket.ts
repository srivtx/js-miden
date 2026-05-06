import IORedis from 'ioredis';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

export const websocketChannel = {
  async send(userId: string, content: string) {
    // Publish to Redis for WS fan-out
    await redis.publish(`user:${userId}:inapp`, JSON.stringify({ content, timestamp: new Date().toISOString() }));
    return { success: true, channel: 'inapp' };
  },
};
