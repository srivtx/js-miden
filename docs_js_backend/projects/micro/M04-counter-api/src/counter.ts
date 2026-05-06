import { Redis } from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
});

/**
 * BUG: This implements a read-modify-write pattern which is NOT atomic.
 * Under concurrent requests, multiple clients read the same value,
 * increment it locally, and write back the same new value.
 * Result: lost increments.
 */
export async function increment(): Promise<number> {
  const current = await redis.get('counter');
  const value = parseInt(current || '0', 10) + 1;
  await redis.set('counter', value.toString());
  return value;
}

/**
 * FIXED VERSION (for reference - replace the function above with this):
 * Redis INCR is atomic and handles concurrency correctly.
 */
// export async function increment(): Promise<number> {
//   return redis.incr('counter');
// }

export async function getCount(): Promise<number> {
  const value = await redis.get('counter');
  return parseInt(value || '0', 10);
}
