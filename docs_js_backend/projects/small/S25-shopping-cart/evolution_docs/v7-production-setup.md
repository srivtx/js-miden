# v7-production-setup

## Goal
Run the cart service in production: persistent, scalable, secure, and observable.

## Changes
1. **Redis persistence** — Replace in-memory `Map` with Redis hashes + TTL.
2. **Session-backed carts** — Cookie-signed `cartId` so users cannot tamper.
3. **Merge on login** — Atomic Lua script in Redis merges guest → user cart.
4. **Expiry / cleanup** — Redis `EXPIRE` on cart keys; no cron needed.
5. **Inventory check** — Before add, call inventory service; reject if out of stock.
6. **Rate limiting** — `express-rate-limit` per IP on add/merge.
7. **Health checks** — `/health` returns Redis connectivity status.
8. **Structured logging** — `pino` with `pino-pretty` dev and JSON prod.
9. **Graceful shutdown** — Drain requests, close Redis, then exit.

## Code

```ts
// src/service.ts
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const CART_TTL_SECONDS = 60 * 60 * 24; // 24h

export async function addToCart(data: AddToCartRequest): Promise<Cart> {
  const cartId = data.cartId || randomUUID();
  const key = `cart:${cartId}`;

  // Inventory check
  const inStock = await checkInventory(data.productId, data.quantity);
  if (!inStock) throw new Error('Out of stock');

  const cart = await redis.hgetall(key);
  // ... merge logic using Redis pipelines
  await redis.pipeline()
    .hset(key, 'updatedAt', new Date().toISOString())
    .expire(key, CART_TTL_SECONDS)
    .exec();

  return hydrateCart(cartId, cart);
}

export async function cleanupExpiredCarts(): Promise<number> {
  // Redis handles expiry automatically; this is for metrics only
  const info = await redis.info('keyspace');
  // parse expired_keys counter
  return parseInt(info.match(/expired_keys:(\d+)/)?.[1] || '0', 10);
}
```

```ts
// src/index.ts
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await redis.quit();
    process.exit(0);
  });
});
```

## Decisions
- **Redis over Postgres** for carts because TTL is native, Lua is atomic, and session data is ephemeral.
- **Inventory check in service**, not route — keeps business logic centralized.
- **Graceful shutdown** prevents in-flight cart updates from being dropped during deploys.

## Risks
- Redis single-threaded Lua scripts can block if merge carts are huge (>10k items). Cap cart size.
- Inventory race condition between check and add. Use Redis Lua or idempotency keys for true safety.

## ASCII: Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Express     │────▶│   Redis     │
│  (Cookie)   │     │  Rate Limit  │     │  Cart Hash  │
└─────────────┘     └──────────────┘     └─────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  Inventory   │
                       │   Service    │
                       └──────────────┘
```
