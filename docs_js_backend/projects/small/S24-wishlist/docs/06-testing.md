# 06-testing.md

## Running Tests

```bash
npm test
```

Uses Node.js built-in test runner with supertest.

## Test Coverage

- **Add item** — creates wishlist entry
- **Remove item** — deletes by item ID
- **Deduplication** — rejects duplicate product for same user
- **User isolation** — users only see their own items

## Failing Tests

Two tests intentionally fail due to Phase 1 bugs:

1. `should not allow duplicate items` — same product added twice
2. `should isolate wishlists by user` — returns all items regardless of user

## Fixing

1. Check `userId + productId` uniqueness before insert, return 409 if exists
2. Filter `getWishlist(userId)` to only return matching `userId` items
3. Add composite unique constraint in database: `UNIQUE(user_id, product_id)`
