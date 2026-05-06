import { redis } from '../config/index.js';

/**
 * Redis storage abstraction for real-time analytics.
 * Provides atomic operations and proper error handling.
 */
export class RedisStorage {
  /**
   * Atomically increment a counter.
   */
  async increment(key: string, ttlSeconds?: number): Promise<number> {
    const result = await redis.incr(key);
    if (ttlSeconds) {
      await redis.expire(key, ttlSeconds);
    }
    return result;
  }

  /**
   * Atomically increment a hash field.
   */
  async incrementHash(key: string, field: string, amount = 1, ttlSeconds?: number): Promise<number> {
    const result = await redis.hincrby(key, field, amount);
    if (ttlSeconds) {
      await redis.expire(key, ttlSeconds);
    }
    return result;
  }

  /**
   * Atomically add to a sorted set with score.
   */
  async addToSortedSet(key: string, score: number, member: string, ttlSeconds?: number): Promise<number> {
    const result = await redis.zadd(key, score, member);
    if (ttlSeconds) {
      await redis.expire(key, ttlSeconds);
    }
    return result;
  }

  /**
   * Get count of members in a sorted set within a score range.
   */
  async countInRange(key: string, min: number, max: number): Promise<number> {
    return redis.zcount(key, min, max);
  }

  /**
   * Execute multiple operations atomically using pipeline.
   */
  async pipeline(operations: (pipeline: ReturnType<typeof redis.pipeline>) => void): Promise<unknown[]> {
    const pipeline = redis.pipeline();
    operations(pipeline);
    return pipeline.exec().then((results) => results?.map(([, result]) => result) ?? []);
  }

  /**
   * Lua script for atomic read-modify-write operations.
   * Prevents race conditions by executing on the Redis server.
   */
  async atomicUpdate(key: string, script: string, keys: string[], args: (string | number)[]): Promise<unknown> {
    return redis.eval(script, keys.length, ...keys, ...args.map(String));
  }

  /**
   * Get TTL of a key.
   */
  async getTTL(key: string): Promise<number> {
    return redis.ttl(key);
  }

  /**
   * Delete keys matching a pattern.
   */
  async deletePattern(pattern: string): Promise<number> {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    return redis.del(...keys);
  }
}

export const redisStorage = new RedisStorage();