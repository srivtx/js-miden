# S24 Wishlist — v2 Add TypeScript

## The Bug: Types Catch Wishlist Bugs

You add price tracking:

```js
function addItem(data) {
  const item = {
    id: generateId(),
    userId: data.userId,
    productId: data.productId,
    productName: data.productName,
    price: data.price,
  };
  wishlist.push(item);
  return item;
}
```

**The bug:** `price` might be `'29.99'` (a string). Later, `checkPriceChanges` compares `currentPrice !== item.price`. If `currentPrice` is a number and `item.price` is a string, `'29.99' !== 29.99` is `true`. Every item appears as a price change. Another bug:
```js
app.get('/wishlist/:userId', (req, res) => {
  res.json(wishlist); // Bug: returns ALL wishlists
});
```

Without types, you don't notice the missing `filter` until a user complains.

## The Fix: Add TypeScript

```ts
// types.ts
export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  price: number;
  addedAt: Date;
}

export interface PriceChange {
  productId: string;
  oldPrice: number;
  newPrice: number;
  changedAt: Date;
}

export interface AddItemRequest {
  userId: string;
  productId: string;
  productName: string;
  price: number;
}
```

```ts
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  // Bug is still here but now clearly visible
  return wishlistStore;
}

export async function addItem(data: AddItemRequest): Promise<WishlistItem> {
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

**What TS catches:**
- `price: '29.99'` → compile error: string not assignable to number
- Missing `addedAt` → compile error
- `getWishlist` returns unfiltered array — type is correct but logic is wrong

## The Pain That Remains

TypeScript knows `price` is a `number`, but it doesn't enforce that `price >= 0`. It doesn't prevent duplicate items. It doesn't validate that `productId` is non-empty. We need runtime validation.

## What v3 Fixes

Validation. Ensure every wishlist item is valid before it's stored.
