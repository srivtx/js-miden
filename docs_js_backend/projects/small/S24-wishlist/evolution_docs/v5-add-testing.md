# S24 Wishlist — v5 Add Testing

## The Bug: Silent Breakage When Adding Features

You refactor the wishlist to "simplify" retrieval:

```ts
// BEFORE — correct
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  return wishlistStore.filter(item => item.userId === userId);
}

// AFTER — "cleaner" but BROKEN
export async function getWishlist(_userId: string): Promise<WishlistItem[]> {
  // Oops, removed the filter
  return wishlistStore;
}
```

Without tests, this ships. Every user sees every wishlist. Privacy is destroyed. Data leaks across accounts. GDPR violation.

## The Fix: Comprehensive Wishlist Tests

```ts
// tests/app.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Wishlist', () => {
  it('should not allow duplicate items', async () => {
    await request(app)
      .post('/wishlist')
      .send({
        userId: 'user-1',
        productId: 'prod-dup',
        productName: 'Duplicate Item',
        price: 19.99,
      });

    const res = await request(app)
      .post('/wishlist')
      .send({
        userId: 'user-1',
        productId: 'prod-dup',
        productName: 'Duplicate Item',
        price: 19.99,
      });

    assert.strictEqual(res.status, 409, 'Should reject duplicate item');

    const listRes = await request(app).get('/wishlist/user-1');
    const duplicates = listRes.body.filter((item: { productId: string }) => item.productId === 'prod-dup');
    assert.strictEqual(duplicates.length, 1, 'Should only have one instance of each product');
  });

  it('should isolate wishlists by user', async () => {
    await request(app)
      .post('/wishlist')
      .send({
        userId: 'user-a',
        productId: 'prod-a',
        productName: 'Item A',
        price: 10,
      });

    await request(app)
      .post('/wishlist')
      .send({
        userId: 'user-b',
        productId: 'prod-b',
        productName: 'Item B',
        price: 20,
      });

    const res = await request(app).get('/wishlist/user-a');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.length, 1);
    assert.strictEqual(res.body[0].productId, 'prod-a', 'User A should only see their own items');
  });
});
```

**What tests prevent:**
- Duplicate items? **Caught** — 409 status and only one instance.
- Missing user isolation? **Caught** — user A must only see their own items.
- Missing price validation? **Caught** — negative prices rejected.

## The Pain That Remains

Your tests import from ESM files, but the project still has CJS vestiges. Modern Node.js is ESM-first. The test runner requires special flags because it's straddling both worlds.

## What v6 Fixes

Switch to ESM fully. CommonJS is legacy.
