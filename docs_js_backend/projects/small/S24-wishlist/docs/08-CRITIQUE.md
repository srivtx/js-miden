# 08-CRITIQUE.md

## What Works

1. **Simple API design**: Four endpoints cover the full CRUD lifecycle clearly.
2. **Price tracking concept**: The `priceHistory` Map and `checkPriceChanges` function demonstrate a real e-commerce value-add.
3. **Test coverage**: Both failing tests (deduplication and isolation) are precise and user-centric.
4. **Type safety**: `WishlistItem` and `PriceChange` interfaces prevent shape mismatches.

## What Doesn't Work

1. **No user isolation**: `getWishlist` returning the entire array is a catastrophic privacy bug. This is the kind of vulnerability that makes headlines.
2. **No deduplication**: Allowing duplicate items is a UX anti-pattern that confuses users and corrupts analytics.
3. **No authorization**: `userId` passed as a URL parameter with no validation. In production, this is an open door to data theft.
4. **Inconsistent security**: `removeItem` checks `userId` but `getWishlist` does not. This inconsistency is a code smell.
5. **In-memory storage**: Data lost on restart. No persistence for a feature users expect to survive sessions.

## What Could Be Better

1. **Row-level security from day one**: Even in-memory storage should use a `Map<string, WishlistItem[]>` keyed by userId to enforce isolation at the data structure level.
2. **Idempotency keys**: For "add to wishlist" operations, accept an idempotency key to prevent duplicate creation from network retries.
3. **Soft deletes**: Instead of `splice(index, 1)`, mark items as `deletedAt`. Users accidentally remove items and want to undo.
4. **Wishlist metadata**: Track `name`, `isDefault`, and `isPublic` for advanced wishlist features (shared wishlists, gift registries).
5. **Event-driven price tracking**: Instead of polling `checkPriceChanges`, subscribe to a product price change event stream (Kafka, SQS) and push notifications to affected users.

## Honest Assessment

This project demonstrates two of the most common bugs in junior backend code: missing authorization checks and missing uniqueness constraints. Both are "invisible" during development—everything works fine with one user and one item. They only break in production with real data and real users.

The privacy bug is especially dangerous because it is silent. Users do not know their data was exposed. It only surfaces during a security audit, a bug report, or a data breach investigation.

**Grade: B as a teaching tool. F as production code (privacy violation).**

## ASCII: Maturity Ladder

```
Level 5: Encrypted at rest, audit logging, compliance certifications (SOC2, ISO 27001)
   |
Level 4: Row-level security, soft deletes, event-driven price alerts, shared wishlists
   |
Level 3: Database constraints, JWT auth, pagination, Redis caching, idempotency keys
   |
Level 2: In-memory Map per user, basic filtering, duplicate checks in code
   |
Level 1: Shared array, no filtering, no deduplication  <-- YOU ARE HERE
   |
Level 0: No wishlist, users email themselves product links  <-- STARTING POINT
```
