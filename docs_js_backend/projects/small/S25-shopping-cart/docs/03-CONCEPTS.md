# 03-CONCEPTS.md

## WHAT

A shopping cart service that:
1. Creates carts with secure, unpredictable IDs
2. Adds/removes items with automatic total calculation
3. Merges guest carts into user carts on login
4. Automatically expires abandoned carts after a TTL
5. Prevents cart ID enumeration and session fixation

## WHY

| Without This Service | With This Service |
|---------------------|-------------------|
| Attackers can guess cart IDs and modify carts | Cryptographically random IDs prevent enumeration |
| Carts accumulate forever, exhausting memory | TTL auto-cleans abandoned sessions |
| Guest cart lost on login | Seamless merge preserves shopping progress |
| Cart total calculated client-side (tamper risk) | Server-side total calculation prevents fraud |
| No session expiry = stale data and security risk | Expired carts return 404, forcing fresh starts |

## HOW

### Step 1: Create Cart with Secure ID
```typescript
import { randomUUID } from 'crypto';

function generateCartId(): string {
  return randomUUID();  // 122 bits of entropy
}
```

### Step 2: Add Item
```typescript
export async function addToCart(data: { cartId?: string; productId: string; quantity: number; price: number }): Promise<Cart> {
  let cartId = data.cartId || generateCartId();
  let cart = cartStore.get(cartId);
  
  if (!cart) {
    cart = { id: cartId, items: [], total: 0, createdAt: new Date(), updatedAt: new Date() };
    cartStore.set(cartId, cart);
  }
  
  const existing = cart.items.find(item => item.productId === data.productId);
  if (existing) {
    existing.quantity += data.quantity;
  } else {
    cart.items.push({ productId: data.productId, productName: data.productName, quantity: data.quantity, price: data.price });
  }
  
  cart.total = calculateTotal(cart.items);
  cart.updatedAt = new Date();
  return cart;
}
```

### Step 3: Expire Old Carts
```typescript
export async function cleanupExpiredCarts(): Promise<number> {
  const now = Date.now();
  const ttl = 24 * 60 * 60 * 1000; // 24 hours
  let cleaned = 0;
  
  for (const [id, cart] of cartStore) {
    if (now - cart.updatedAt.getTime() > ttl) {
      cartStore.delete(id);
      cleaned++;
    }
  }
  
  return cleaned;
}
```

### Step 4: Merge Carts on Login
```typescript
export async function mergeCartOnLogin(guestCartId: string, userCartId: string): Promise<Cart | undefined> {
  const guestCart = cartStore.get(guestCartId);
  const userCart = cartStore.get(userCartId);
  
  if (!guestCart) return userCart;
  if (!userCart) return guestCart;
  
  for (const guestItem of guestCart.items) {
    const existing = userCart.items.find(item => item.productId === guestItem.productId);
    if (existing) {
      existing.quantity += guestItem.quantity;
    } else {
      userCart.items.push(guestItem);
    }
  }
  
  userCart.total = calculateTotal(userCart.items);
  userCart.updatedAt = new Date();
  cartStore.delete(guestCartId);
  
  return userCart;
}
```

## WRONG vs RIGHT

### WRONG: Predictable ID
```typescript
let cartCounter = 0;
function generateCartId(): string {
  cartCounter++;
  return `cart-${cartCounter}`;  // cart-1, cart-2, cart-3...
}
```

### RIGHT: Secure Random ID
```typescript
import { randomUUID } from 'crypto';
function generateCartId(): string {
  return randomUUID();  // e.g., "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

### WRONG: No Expiry
```typescript
export async function cleanupExpiredCarts(): Promise<number> {
  return 0;  // Does nothing. Carts live forever.
}
```

### RIGHT: TTL-Based Cleanup
```typescript
export async function cleanupExpiredCarts(): Promise<number> {
  const now = Date.now();
  const ttl = 24 * 60 * 60 * 1000;
  let cleaned = 0;
  
  for (const [id, cart] of cartStore) {
    if (now - cart.updatedAt.getTime() > ttl) {
      cartStore.delete(id);
      cleaned++;
    }
  }
  return cleaned;
}
```

## ASCII: System Architecture

```
+--------+     +-----------+     +----------------+     +---------+
| Client |---->|  Express  |---->| Secure Cart    |---->| Store   |
+--------+     |  Router   |     | ID Generation  |     | (Map)   |
               +-----------+     +----------------+     +---------+
                     |                |                      |
                     v                v                      v
               +-----------+     +----------------+     +---------+
               | GET /:id  |     | Expiry Check   |     | Merge   |
               +-----------+     | (TTL)          |     | Logic   |
                                 +----------------+     +---------+
```

## ASCII: Session Fixation Attack

```
Attacker creates cart-1, adds $0.01 item
       |
       v
Attacker shares link: /cart/cart-1
       |
       v
Victim clicks link, adds $500 item
       |
       v
Attacker checks cart-1 — sees $500 item
       |
       v
Attacker changes shipping address to theirs
       |
       v
Attacker checks out with victim's items!

Fix: UUID prevents guessing. Cookie binding prevents sharing.
```
