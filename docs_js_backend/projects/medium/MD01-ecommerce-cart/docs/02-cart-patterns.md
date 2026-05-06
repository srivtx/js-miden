# MD01: Cart Patterns — Session vs. Database Storage

## The Core Dilemma

Where does the cart live?
- **Client-Side (Session/Cookie)**: Fast, but fragile.
- **Server-Side (Database)**: Durable, but slower.
- **Hybrid (Redis + DB)**: Best of both worlds, but complex.

Amazon's cart is famously persistent. If you add an item on mobile, it appears on desktop. This requires server-side storage. However, anonymous browsing carts may be stored in cookies or localStorage until login.

## Pattern 1: Pure Session Storage (Client-Side)

```javascript
// Express session with cookie-based cart
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

app.post('/cart/add', (req, res) => {
  const { productId, quantity } = req.body;
  req.session.cart = req.session.cart || [];
  req.session.cart.push({ productId, quantity });
  res.json({ success: true });
});
```

### Pros
- Zero database load for reads/writes
- Instantaneous

### Cons
- 4KB cookie limit (compressed carts needed)
- Lost on device switch
- Tamper risk (must sign/HMAC)
- Cannot enforce inventory limits

## Pattern 2: Pure Database Storage

```sql
BEGIN;
  INSERT INTO cart_items (cart_id, product_id, quantity)
  VALUES ('cart-123', 'prod-456', 2)
  ON CONFLICT (cart_id, product_id)
  DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity;
COMMIT;
```

### Pros
- Persistent across devices
- Centralized inventory validation
- Supports analytics (what's in carts?)

### Cons
- Higher latency (10-50ms DB roundtrip)
- Database load scales with DAU

## Pattern 3: Hybrid (Redis + PostgreSQL)

This is the production pattern used by most mid-to-large e-commerce platforms.

```
Write Path:
  Client → API → Redis (fast accept) → Async Worker → PostgreSQL (durability)

Read Path:
  Client → API → Redis (cache) → [fallback] → PostgreSQL
```

```javascript
// Pseudocode for hybrid cart
async function addToCart(cartId, productId, quantity) {
  // 1. Validate inventory in DB (synchronous, must be consistent)
  const stock = await db.query(
    'SELECT available FROM inventory WHERE product_id = $1 FOR UPDATE',
    [productId]
  );

  if (stock.rows[0].available < quantity) {
    throw new Error('Insufficient stock');
  }

  // 2. Write to Redis for speed
  await redis.hincrby(`cart:${cartId}`, productId, quantity);
  await redis.expire(`cart:${cartId}`, 7 * 24 * 60 * 60); // 7 days

  // 3. Enqueue for durable write
  await messageQueue.publish('cart.persist', { cartId, productId, quantity });

  return { success: true };
}
```

## Comparison Matrix

| Dimension | Client-Side | Database | Hybrid |
|-----------|-------------|----------|--------|
| Latency | < 1ms | 10-50ms | 5-15ms |
| Durability | Poor | Strong | Strong |
| Cross-Device | No | Yes | Yes |
| Inventory Safety | None | Strong | Strong* |
| Complexity | Low | Medium | High |

*Hybrid requires careful consistency protocol (see `race-conditions.md`).

## Migration Strategy: Anonymous → Authenticated

A critical UX moment: the user logs in and already has a cart. What happens?

1. **Merge**: Combine guest and user carts (Amazon's approach)
2. **Replace**: User cart overwrites guest cart
3. **Prompt**: Ask user which to keep

```sql
-- Merge strategy: add quantities for same SKU, keep distinct SKUs
BEGIN;
  INSERT INTO cart_items (cart_id, product_id, quantity)
  SELECT user_cart.id, guest.product_id, guest.quantity
  FROM cart_items guest
  JOIN carts guest_cart ON guest.cart_id = guest_cart.id
  JOIN carts user_cart ON user_cart.user_id = $1
  WHERE guest_cart.session_id = $2
    AND guest_cart.user_id IS NULL
  ON CONFLICT (cart_id, product_id)
  DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity;

  UPDATE carts SET status = 'merged' WHERE session_id = $2;
COMMIT;
```

## Key Takeaway

> "The cart is not just a data structure; it is a consistency boundary." — Inspired by Pat Helland's "Life Beyond Distributed Transactions" (2016).

For medium-scale systems, the **Hybrid pattern** is recommended, with Redis as the hot path and PostgreSQL as the source of truth. The async persistence queue must be monitored for lag; if the lag exceeds the Redis TTL, data loss occurs.
