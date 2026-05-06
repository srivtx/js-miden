# 01-THINKING.md

## Mental Model

Think of a shopping cart like a hotel room key card. The key card must be:
1. **Unpredictable**: You cannot guess another guest's room number
2. **Temporary**: It expires after checkout (or 24 hours)
3. **Transferable**: You can merge two carts (room service charges + minibar charges)
4. **Secure**: The front desk verifies your identity before giving you a new card

## Key Insights

### Insight 1: Predictable IDs are a security vulnerability

Sequential counters, timestamps, or short random strings can be enumerated. An attacker scanning `cart-1` through `cart-10000` will find active carts, view contents, and potentially modify them.

### Insight 2: Sessions must expire

The average e-commerce cart abandonment rate is 70%. Without expiration, 70% of your storage is dead data. Redis TTL, cron jobs, or database event triggers are all valid approaches.

### Insight 3: Cart merge is a business rule

When a user logs in, their guest cart (built while browsing anonymously) should merge with their saved user cart. The business rule is usually: same product = add quantities, different products = append.

### Insight 4: Cart IDs are secrets

A cart ID is as sensitive as a session token. It should be transported in signed cookies or encrypted localStorage, never in URL parameters where it can be leaked in referrer headers.

## Design Philosophy

- **Unpredictability by default**: Use `crypto.randomUUID()` or `crypto.randomBytes()` for all identifiers
- **Ephemeral by design**: Every cart has a TTL; expired carts are inaccessible
- **Atomic merges**: Merge operations should be transactional (all or nothing)
- **Defense in depth**: Even if the ID is leaked, rate limiting and IP binding reduce abuse

## Trade-offs Considered

| ID Strategy | Predictability | Length | Performance | Best For |
|-------------|----------------|--------|-------------|----------|
| Sequential counter | Very high | Short | Fast | Never |
| Timestamp + counter | High | Medium | Fast | Internal IDs only |
| UUID v4 | Very low | 36 chars | Medium | General purpose |
| CUID2 | Very low | 24 chars | Medium | URL-safe IDs |
| NanoID | Very low | 21 chars | Fast | Short URLs |

## ASCII: Attack Surface

```
Attacker scans cart IDs
        |
   +----+----+
   |         |
cart-1   cart-2
   |         |
   v         v
[Active]  [Active]
   |         |
   v         v
Modify    View
items     contents

Fix: Use UUIDv4 (2.7e+18 possible values)
     Brute force is computationally infeasible
```
