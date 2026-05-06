# 06-testing.md

## Running Tests

```bash
npm test
```

Uses Node.js built-in test runner with supertest.

## Test Coverage

- **Cart creation** — generates ID and stores items
- **Add to cart** — updates quantities and totals
- **Merge** — combines guest and user carts
- **Security** — cart IDs should be unpredictable
- **Expiry** — old carts should be cleaned up

## Failing Tests

Two tests intentionally fail due to Phase 1 bugs:

1. `should generate unpredictable cart IDs` — sequential `cart-1`, `cart-2` format
2. `should expire old carts` — `cleanupExpiredCarts` is a no-op

## Fixing

1. Use `crypto.randomUUID()` or `crypto.randomBytes()` for cart IDs
2. Store `createdAt` and implement TTL in Redis (`EXPIRE` key)
3. Run cleanup job periodically or use Redis key expiration events
