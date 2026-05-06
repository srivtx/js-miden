# S24 Wishlist — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
S24-wishlist/
├── src/
│   ├── index.ts            # Express app
│   ├── routes.ts           # HTTP endpoints
│   ├── service.ts          # Wishlist storage + price tracking
│   └── types.ts            # TypeScript interfaces
├── tests/
│   └── app.test.ts         # Node.js test runner + supertest
├── evolution_docs/         # This documentation
├── package.json
├── tsconfig.json
└── dist/                   # Compiled JS (gitignored)
```

### Key Production Decisions

**1. User Isolation**

```ts
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  // BUG: No user isolation — returns all items, not filtered by userId.
  return wishlistStore;
}
```

In production, this would filter by `userId`. The bug is intentional for learning.

**2. Deduplication**

```ts
export async function addItem(data: { userId: string; productId: string; productName: string; price: number }): Promise<WishlistItem> {
  // BUG: No deduplication — same item can be added twice.
  const item: WishlistItem = {
    id: generateId(),
    userId: data.userId,
    productId: data.productId,
    productName: data.productName,
    price: data.price,
    addedAt: new Date(),
  };

  wishlistStore.push(item);
  priceHistory.set(data.productId, data.price);
  return item;
}
```

In production, this would check for existing `(userId, productId)` pairs and reject duplicates.

**3. Price Tracking**

```ts
export async function checkPriceChanges(userId: string): Promise<PriceChange[]> {
  const items = await getWishlist(userId);
  const changes: PriceChange[] = [];

  for (const item of items) {
    const currentPrice = priceHistory.get(item.productId);
    if (currentPrice && currentPrice !== item.price) {
      changes.push({
        productId: item.productId,
        oldPrice: item.price,
        newPrice: currentPrice,
        changedAt: new Date(),
      });
    }
  }

  return changes;
}
```

Price changes are detected by comparing the stored price with the current price in `priceHistory`.

**4. Sharing**

In production, a `sharedWith` array or public link token would allow users to share their wishlist. This is not implemented in the learning version but is the natural next evolution.

**5. Self-execution Guard**

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT);
}
```

Tests import `{ app }` without starting the server.

### The Intentional Bugs (For Learning)

The source code contains two bugs:

**Bug 1: No Deduplication**
```ts
// BUG: No deduplication — same item can be added twice.
// Should check if productId already exists for this user.
const item: WishlistItem = {
  // ...
};
wishlistStore.push(item);
```

The same product can be added to the same user's wishlist multiple times.

**Bug 2: No User Isolation**
```ts
// BUG: No user isolation — returns all items, not filtered by userId.
// User A can see user B's wishlist.
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  return wishlistStore;
}
```

`GET /wishlist/:userId` returns every wishlist item for every user. Privacy violation.

**Why are these here?** To demonstrate that a wishlist without tests is worse than no wishlist. The tests in `app.test.ts` verify:
- Duplicate items must be rejected with 409
- User A must only see their own items

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | In-memory, no isolation, no deduplication | Wrote naive JS |
| v2 | Type errors in wishlist handling | Added TypeScript |
| v3 | Invalid items entering wishlist | Added runtime validation |
| v4 | Silent privacy violations | Added structured logging |
| v5 | Deduplication removed, isolation broken | Added comprehensive wishlist tests |
| v6 | Legacy module system | Full ESM alignment |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # node --watch --loader ts-node/esm src/index.ts
npm run build    # tsc
npm start        # node dist/index.js
npm test         # node --test tests/**/*.test.ts
```

**Note:** This project uses the Node.js built-in test runner (not Jest/Vitest) to demonstrate native ESM + TypeScript testing without external test frameworks.
