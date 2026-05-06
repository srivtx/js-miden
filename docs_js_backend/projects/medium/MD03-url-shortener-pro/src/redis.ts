import { createClient } from 'redis';
import { config } from './config.js';

export const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => console.error('Redis Client Error', err));

export async function connectRedis(): Promise<void> {
  await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  await redis.disconnect();
}
