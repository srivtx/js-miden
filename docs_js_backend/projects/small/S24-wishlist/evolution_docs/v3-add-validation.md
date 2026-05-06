# S24 Wishlist — v3 Add Validation

## The Bug: Validation Catches Wishlist Bugs

Your TypeScript wishlist accepts any request:

```ts
export async function addItem(data: { userId: string; productId: string; productName: string; price: number }): Promise<WishlistItem> {
  const item: WishlistItem = {
    id: generateId(),
    userId: data.userId,
    productId: data.productId,
    productName: data.productName,
    price: data.price,
    addedAt: new Date(),
  };
  wishlistStore.push(item);
  return item;
}
```

Without validation:
- `price: -10` — TypeScript says it's a `number`, but negative prices don't make sense
- `productId: ''` — empty product ID breaks deduplication
- `userId: ''` — empty user ID breaks isolation
- `productName: ''` — empty name is useless in the UI
- The same product is added twice — no deduplication check

TypeScript ensures the types match, but it doesn't validate business rules at runtime.

## The Fix: Runtime Wishlist Validation

```ts
function validateAddItem(data: { userId: string; productId: string; productName: string; price: number }): void {
  if (!data.userId || data.userId.trim().length === 0) {
    throw new Error('userId is required');
  }
  if (!data.productId || data.productId.trim().length === 0) {
    throw new Error('productId is required');
  }
  if (!data.productName || data.productName.trim().length === 0) {
    throw new Error('productName is required');
  }
  if (isNaN(data.price) || data.price < 0) {
    throw new Error('price must be a non-negative number');
  }
}

function checkDuplicate(userId: string, productId: string): boolean {
  return wishlistStore.some(item => item.userId === userId && item.productId === productId);
}
```

```ts
export async function addItem(data: { userId: string; productId: string; productName: string; price: number }): Promise<WishlistItem> {
  validateAddItem(data);
  if (checkDuplicate(data.userId, data.productId)) {
    throw new Error('Item already in wishlist');
  }
  // ...
}
```

**What validation prevents:**
- Negative prices are rejected
- Empty product IDs are blocked
- Duplicate items are refused
- Empty user IDs are caught

## The Pain That Remains

You validate requests, but you still have no visibility into wishlist usage. When users complain about missing items, you don't know if it was a server restart or a bug. There's no logging of add/remove events or price changes.

## What v4 Fixes

Logging. Observe wishlist behavior in production.
