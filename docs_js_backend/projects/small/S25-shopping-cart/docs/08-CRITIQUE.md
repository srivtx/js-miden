# 08-CRITIQUE.md

## What Works

1. **Merge logic**: The `mergeCartOnLogin` function correctly adds quantities for matching products and appends new ones. This is the standard e-commerce behavior.
2. **Server-side total**: `calculateTotal` runs on the server, preventing basic client-side price tampering.
3. **Test design**: The predictability test (`!id2.startsWith('cart-')`) and expiry test are objective, automated, and unambiguous.
4. **Type safety**: `Cart` and `CartItem` interfaces make the data model clear.

## What Doesn't Work

1. **Sequential cart IDs**: This is a security vulnerability, not a minor bug. It enables enumeration, data theft, and potential fraud.
2. **No expiry**: `cleanupExpiredCarts` is a no-op. In production, this causes memory leaks, storage exhaustion, and analytics pollution.
3. **Cart ID in JSON body**: Transporting session identifiers in response bodies (instead of signed cookies) makes them vulnerable to XSS and referrer leakage.
4. **No price validation**: Client-provided `price` is trusted. A malicious request could send `"price": 0.01`.
5. **No inventory check**: Items can be added regardless of stock. Checkout may fail after payment details are entered.
6. **In-memory storage**: Carts lost on restart. Not acceptable for any real store.

## What Could Be Better

1. **Use Redis from day one**: The `docker-compose.yml` already includes Redis. Use `ioredis` (in package.json) with `EXPIRE` for TTL.
2. **Signed cookies**: Store `cartId` in a signed, httpOnly, secure cookie. Prevents tampering and XSS extraction.
3. **Catalog price lookup**: On `addToCart`, fetch the real price from product catalog API. Ignore client price.
4. **Inventory reservation**: Reserve stock on add, release on expiry. Prevents overselling.
5. **Cart abandonment pipeline**: Trigger email sequence after 1 hour, 24 hours, 72 hours of inactivity. Recover 10-15% of abandoned carts.
6. **Idempotency keys**: For "add to cart" operations, accept idempotency key to prevent duplicates from network retries.

## Honest Assessment

This project demonstrates two foundational e-commerce bugs that appear constantly in penetration test reports: predictable session IDs and missing session expiry. Both are "invisible" during development—everything works with one user and one cart. They only break under real load or when an attacker starts probing.

The sequential counter is a particularly dangerous anti-pattern because it looks reasonable. "`cart-1`, `cart-2`—that's organized!" But organization is the enemy of security here. Randomness is the only defense against enumeration.

**Grade: B as a teaching tool. D as production code (security vulnerability).**

## ASCII: Maturity Ladder

```
Level 5: PCI-DSS compliant, encrypted at rest, fraud detection, A/B testing on checkout
   |
Level 4: Signed cookies, inventory reservation, cart abandonment emails, analytics pipeline
   |
Level 3: Redis TTL, catalog price validation, rate limiting, idempotency keys
   |
Level 2: UUID IDs, basic cleanup job, cookie-based sessions
   |
Level 1: Sequential IDs, no expiry, JSON body transport  <-- YOU ARE HERE
   |
Level 0: No cart, users email their order  <-- STARTING POINT
```
