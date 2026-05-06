# 04-OLD-VS-NEW.md

## 2015 Approach (Predictable / No Expiry)

### Architecture
- Sequential cart IDs (`cart-1`, `cart-2`)
- No cleanup logic
- Cart ID in URL parameters
- No merge logic for guest-to-user transitions

### Code Pattern
```javascript
// 2015-style: Predictable, permanent, insecure
var cartCounter = 0;
var carts = {};

function createCart() {
  cartCounter++;
  return { id: 'cart-' + cartCounter, items: [] };
}

function getCart(id) {
  return carts[id];  // No expiry check
}
```

### Problems
- `cart-1` through `cart-10000` can be enumerated in minutes
- Carts from 2015 still in memory
- No way to merge anonymous browsing with logged-in account
- Cart total can be manipulated client-side

---

## 2025 Approach (Secure / Ephemeral)

### Architecture
- Cryptographically random UUIDs for cart IDs
- Redis EXPIRE or periodic cleanup jobs
- Signed cookies for cart ID transport
- Atomic merge with quantity addition
- Server-side total calculation

### Code Pattern
```typescript
// 2025-style: Secure, ephemeral, robust
import { randomUUID } from 'crypto';

async function createCart(): Promise<Cart> {
  const cart: Cart = {
    id: randomUUID(),
    items: [],
    total: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await redis.setex(`cart:${cart.id}`, CART_TTL_SECONDS, JSON.stringify(cart));
  return cart;
}

async function getCart(id: string): Promise<Cart | null> {
  const data = await redis.get(`cart:${id}`);
  if (!data) return null;  // Expired or never existed
  return JSON.parse(data);
}

async function mergeCarts(guestId: string, userId: string): Promise<Cart> {
  const guest = await getCart(guestId);
  const user = await getCart(userId);
  
  if (!guest) return user;
  if (!user) {
    await redis.rename(`cart:${guestId}`, `cart:${userId}`);
    return guest;
  }
  
  // Merge items
  for (const item of guest.items) {
    const existing = user.items.find(i => i.productId === item.productId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      user.items.push(item);
    }
  }
  
  user.total = calculateTotal(user.items);
  await redis.setex(`cart:${userId}`, CART_TTL_SECONDS, JSON.stringify(user));
  await redis.del(`cart:${guestId}`);
  
  return user;
}
```

### Advantages
- Security: Enumeration attacks reduced from feasible to impossible
- Resource usage: Memory stable instead of growing forever
- UX: Guest cart seamlessly transitions to logged-in cart
- Integrity: Server calculates totals, preventing price tampering
- Compliance: Session data auto-expires, reducing GDPR scope

## ASCII: Security Comparison

```
2015 (Predictable)                          2025 (Random)
==================                          ==============

cart-1                                      f47ac10b-58cc-...
cart-2                                      550e8400-e29b-...
cart-3                                      6ba7b810-9dad-...
  ...                                       ...
cart-10000                                  (2.7e+18 possibilities)

Scan time: ~10 minutes                      Scan time: ~10^25 years
Risk: HIGH                                  Risk: NEGLIGIBLE
```
