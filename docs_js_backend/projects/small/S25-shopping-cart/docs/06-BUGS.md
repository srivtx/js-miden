# 06-BUGS.md

## Bug 1: Session Fixation — Predictable Cart IDs

**Location:** `src/service.ts`, `generateCartId()` function, lines 9-12

**Current Code:**
```typescript
let cartCounter = 0;

function generateCartId(): string {
  cartCounter++;
  return `cart-${cartCounter}`;
}
```

**Real-World Impact:**

### Scenario: Cart Enumeration Attack
Attacker writes a script to query `GET /cart/cart-1`, `GET /cart/cart-2`, ..., `GET /cart/cart-10000`.

- **Current behavior**: Every existing cart ID returns the full cart contents
- **Data exposed**: Product IDs, quantities, prices, total value
- **Business intelligence**: Attacker builds a dataset of your most popular products and average order values
- **Impact**: Competitive intelligence leak, privacy violation

### Scenario: Cart Hijacking
Attacker discovers User A's cart ID is `cart-42`. Attacker sends:
```bash
POST /cart/cart-42/add
{ "productId": "gift-card-1000", "quantity": 10 }
```

- **Current behavior**: Attacker adds $10,000 in gift cards to User A's cart
- **User A's impact**: Sees unexpected items, gets confused, abandons purchase
- **Business impact**: Gift card fraud, support tickets, chargebacks

### Scenario: Price Manipulation
Attacker modifies items in another user's cart to change prices.

- **Current behavior**: No ownership validation on cart mutations
- **Impact**: Attacker could set prices to $0.01, though checkout would still verify against catalog
- **Risk**: Medium (checkout usually revalidates), but UX damage is real

**Severity:** HIGH — Direct security vulnerability enabling data theft and fraud

**Fix:** Use cryptographically secure random IDs.

```typescript
import { randomUUID } from 'crypto';

function generateCartId(): string {
  return randomUUID();
}
```

**Production fix:** Signed cookies + Redis TTL.
```typescript
// Set signed cookie
res.cookie('cartId', cartId, { signed: true, httpOnly: true, secure: true });

// Redis with TTL
await redis.setex(`cart:${cartId}`, 24 * 60 * 60, JSON.stringify(cart));
```

---

## Bug 2: No Expiry — Carts Accumulate Forever

**Location:** `src/service.ts`, `cleanupExpiredCarts()` function, lines 100-104

**Current Code:**
```typescript
export async function cleanupExpiredCarts(): Promise<number> {
  // Should delete carts older than X hours/days.
  // Currently does nothing.
  return 0;
}
```

**Real-World Impact:**

### Scenario: Holiday Traffic Spike
Black Friday brings 1M visitors. 70% abandon their carts (industry average).

- **Current behavior**: 700,000 carts remain in memory forever
- **Memory impact**: Each cart ~500 bytes = 350MB leaked per event
- **Result**: Server runs out of memory, crashes, loses all active carts during peak sales
- **Revenue impact**: $50,000-$500,000 in lost sales during the outage

### Scenario: Redis Storage Exhaustion
Production uses Redis (configured in docker-compose) but without TTL.

- **Current behavior**: Redis memory grows by ~500MB/month
- **At 6 months**: 3GB of dead cart data
- **Redis eviction policy**: `allkeys-lru` starts evicting active sessions to make room
- **Result**: Legitimate users logged out, carts lost, checkout failures

### Scenario: Analytics Pollution
Business intelligence team runs cart abandonment analysis.

- **Current behavior**: 700,000 "active" carts, 650,000 are 6 months old
- **Impact**: Abandonment rate calculated as 95% instead of 70%
- **Business decision**: Marketing budget misallocated, ROI calculations wrong

**Severity:** MEDIUM-HIGH — Causes resource exhaustion and data quality issues

**Fix:** Implement TTL-based cleanup.

```typescript
export async function cleanupExpiredCarts(): Promise<number> {
  const now = Date.now();
  const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  let cleaned = 0;
  
  for (const [id, cart] of cartStore) {
    if (now - cart.updatedAt.getTime() > TTL_MS) {
      cartStore.delete(id);
      cleaned++;
    }
  }
  
  return cleaned;
}
```

**Production fix:** Redis native TTL.
```typescript
// On cart creation/update
await redis.setex(`cart:${cartId}`, CART_TTL_SECONDS, JSON.stringify(cart));

// No cleanup job needed — Redis auto-deletes expired keys
```

---

## Additional Bug Surface

### No Price Validation
The cart accepts any `price` from the client. A malicious user could send `"price": 0.01` for a $100 item.

**Fix:** Fetch product price from catalog API/server on add. Ignore client-provided price.

### No Inventory Check
Items can be added to cart regardless of stock levels. Checkout may fail after the user has already entered payment details.

**Fix:** Reserve inventory on add, release on expiry or remove. Or at minimum, validate stock availability.
