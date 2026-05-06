# 09-bugs.md

## Bug 1: Session Fixation

**Location:** `src/service.ts` in `generateCartId()`

**Issue:** Cart IDs use a sequential counter (`cart-1`, `cart-2`). Attackers can enumerate cart IDs and access other users' carts, view contents, and potentially modify them.

**Impact:**
- Unauthorized cart access
- Price manipulation
- Privacy breach
- Potential checkout fraud

**Fix:**
```typescript
import { randomUUID } from 'crypto';

function generateCartId(): string {
  return randomUUID();
}
```

Use cryptographically secure random IDs. With Redis, cart IDs can also be stored with TTL and require a signed cookie for validation.

## Bug 2: No Expiry

**Location:** `src/service.ts` in `cleanupExpiredCarts()`

**Issue:** Carts accumulate forever in memory (and would in Redis without TTL). Over time this causes memory leaks, storage costs, and stale data.

**Impact:**
- Memory exhaustion
- Storage cost growth
- Stale cart data interfering with analytics

**Fix:**
```typescript
// Redis TTL
await redis.setex(`cart:${cartId}`, CART_TTL_SECONDS, JSON.stringify(cart));

// Or periodic cleanup
function cleanupExpiredCarts(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, cart] of cartStore) {
    if (now - cart.updatedAt.getTime() > CART_TTL_MS) {
      cartStore.delete(id);
      cleaned++;
    }
  }
  return cleaned;
}
```

Run cleanup via cron job or use Redis key expiration events.
