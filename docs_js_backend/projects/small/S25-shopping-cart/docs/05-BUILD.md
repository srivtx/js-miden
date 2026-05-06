# 05-BUILD.md

## Prerequisites

- Node.js 20+
- npm or pnpm

## Step-by-Step Build

### Step 1: Clone and Install
```bash
cd S25-shopping-cart
npm install
```

### Step 2: Understand the Project Structure
```
S25-shopping-cart/
├── src/
│   ├── index.ts      # Express server setup
│   ├── routes.ts     # HTTP endpoints
│   ├── service.ts    # Business logic (BUGS HERE)
│   └── types.ts      # TypeScript interfaces
├── tests/
│   └── app.test.ts   # Failing tests prove bugs
├── docs/
│   └── (this documentation)
├── package.json
└── tsconfig.json
```

### Step 3: Run the Tests (They Will Fail)
```bash
npm test
```

Expected failures:
- `should generate unpredictable cart IDs` — sequential `cart-1`, `cart-2` format
- `should expire old carts` — `cleanupExpiredCarts` is a no-op

### Step 4: Fix Bug 1 — Use Secure Random IDs

Edit `src/service.ts`:
```typescript
import { randomUUID } from 'crypto';

function generateCartId(): string {
  return randomUUID();  // Replaces sequential counter
}
```

Remove the old counter:
```typescript
// REMOVE these lines:
// let cartCounter = 0;
// function generateCartId(): string {
//   cartCounter++;
//   return `cart-${cartCounter}`;
// }
```

### Step 5: Fix Bug 2 — Implement Cart Expiry

Edit `src/service.ts` in `cleanupExpiredCarts()`:
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

### Step 6: Run Tests Again
```bash
npm test
```

All tests should now pass.

### Step 7: Run the Server
```bash
npm run dev
```

Test with curl:
```bash
# Create a new cart
curl -X POST http://localhost:3000/cart/add \
  -H "Content-Type: application/json" \
  -d '{"productId":"prod-1","productName":"Widget","quantity":2,"price":19.99}'

# Add to existing cart
curl -X POST http://localhost:3000/cart/add \
  -H "Content-Type: application/json" \
  -d '{"cartId":"<id-from-above>","productId":"prod-2","productName":"Gadget","quantity":1,"price":29.99}'

# View cart
curl http://localhost:3000/cart/<cart-id>

# Remove item
curl -X DELETE http://localhost:3000/cart/<cart-id>/item/prod-1

# Merge carts
curl -X POST http://localhost:3000/cart/merge \
  -H "Content-Type: application/json" \
  -d '{"guestCartId":"<guest-id>","userCartId":"<user-id>"}'
```

### Step 8: Production Upgrade Path

1. Replace in-memory Map with Redis (`ioredis` already in package.json)
2. Use `redis.setex()` for automatic TTL
3. Store cart ID in signed, httpOnly cookie
4. Add rate limiting (max 10 cart operations per IP per minute)
5. Validate product prices against catalog API (prevent price tampering)
6. Add inventory reservation during checkout (prevent overselling)
7. Implement cart abandonment email sequence (recover 10-15% of lost revenue)
