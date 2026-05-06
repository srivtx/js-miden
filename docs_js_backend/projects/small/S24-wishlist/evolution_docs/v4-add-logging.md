# S24 Wishlist — v4 Add Logging

## The Bug: Production Visibility Crisis

Your wishlist is supposed to track items for users. But in production:
- You don't know how many items are added or removed per day
- You can't tell if users are seeing each other's wishlists
- You have no record of price changes
- You don't know if duplicate items are being created

```ts
// Without logging — silent wishlist
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
  priceHistory.set(data.productId, data.price);
  return item;
}
```

User A adds an item. User B sees it in their wishlist. You have no log. The privacy violation goes unnoticed until a user complains on Twitter.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

export async function addItem(data: { userId: string; productId: string; productName: string; price: number }): Promise<WishlistItem> {
  validateAddItem(data);
  if (checkDuplicate(data.userId, data.productId)) {
    logger.warn({ userId: data.userId, productId: data.productId }, 'Duplicate item rejected');
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
  logger.info({ itemId: item.id, userId: item.userId, productId: item.productId, price: item.price }, 'Item added to wishlist');
  return item;
}

export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  logger.info({ userId }, 'Wishlist requested');
  const items = wishlistStore.filter(item => item.userId === userId);
  logger.info({ userId, count: items.length }, 'Wishlist returned');
  return items;
}

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
      logger.info({ userId, productId: item.productId, oldPrice: item.price, newPrice: currentPrice }, 'Price change detected');
    }
  }
  
  return changes;
}
```

Now logs tell the story:
```json
{"level":"info","itemId":"abc123","userId":"alice","productId":"widget-1","price":29.99,"msg":"Item added to wishlist"}
{"level":"info","userId":"alice","count":5,"msg":"Wishlist returned"}
{"level":"info","userId":"alice","productId":"widget-1","oldPrice":29.99,"newPrice":19.99,"msg":"Price change detected"}
{"level":"warn","userId":"alice","productId":"widget-1","msg":"Duplicate item rejected"}
```

**Ah.** Alice has 5 items. One dropped in price. A duplicate was correctly rejected.

## The Pain That Remains

You refactor `getWishlist` and accidentally remove the user filter. All wishlists are returned to everyone. Your logs show requests succeeding, but you don't have a test that verifies user isolation.

## What v5 Fixes

Testing. Every wishlist behavior needs a test.
