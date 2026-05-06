import { redis } from '../redis.js';

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

export async function checkIdempotencyKey(key: string): Promise<boolean> {
  const exists = await redis.get(`idempotency:${key}`);
  return exists !== null;
}

export async function storeIdempotencyKey(key: string, orderId: string): Promise<void> {
  await redis.setEx(`idempotency:${key}`, IDEMPOTENCY_TTL_SECONDS, orderId);
}
