# 05-BUILD.md

## Prerequisites

- Node.js 20+
- npm or pnpm

## Step-by-Step Build

### Step 1: Clone and Install
```bash
cd S24-wishlist
npm install
```

### Step 2: Understand the Project Structure
```
S24-wishlist/
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
- `should not allow duplicate items` — same product added twice for same user
- `should isolate wishlists by user` — returns all items regardless of user

### Step 4: Fix Bug 1 — Add Deduplication

Edit `src/service.ts` in `addItem()`:
```typescript
export async function addItem(data: { userId: string; productId: string; productName: string; price: number }): Promise<WishlistItem> {
  // Check if item already exists for this user
  const exists = wishlistStore.find(
    item => item.userId === data.userId && item.productId === data.productId
  );
  
  if (exists) {
    throw new Error('Item already in wishlist');
  }
  
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

Also update the route to return 409:
```typescript
router.post('/', async (req: Request, res: Response) => {
  try {
    const item = await addItem(req.body);
    res.status(201).json(item);
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('already in wishlist')) {
      res.status(409).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
});
```

### Step 5: Fix Bug 2 — Add User Isolation

Edit `src/service.ts` in `getWishlist()`:
```typescript
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  return wishlistStore.filter(item => item.userId === userId);
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
# Add an item
curl -X POST http://localhost:3000/wishlist \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","productId":"prod-1","productName":"Blue Widget","price":29.99}'

# Try to add duplicate (should fail with 409)
curl -X POST http://localhost:3000/wishlist \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-1","productId":"prod-1","productName":"Blue Widget","price":29.99}'

# Add item for different user
curl -X POST http://localhost:3000/wishlist \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-2","productId":"prod-2","productName":"Red Gadget","price":49.99}'

# View user-1's wishlist (should only see prod-1)
curl http://localhost:3000/wishlist/user-1

# View user-2's wishlist (should only see prod-2)
curl http://localhost:3000/wishlist/user-2

# Remove an item
curl -X DELETE http://localhost:3000/wishlist/user-1/<item-id>
```

### Step 8: Production Upgrade Path

1. Replace in-memory store with PostgreSQL
2. Add composite unique constraint: `UNIQUE(user_id, product_id)`
3. Add JWT authorization middleware to validate `userId` ownership
4. Implement pagination for large wishlists (`limit`, `offset`)
5. Background job to check price changes and send email/push alerts
6. Add Redis caching for frequently accessed wishlists
