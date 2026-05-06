import { WishlistItem, PriceChange } from './types.js';

const wishlistStore: WishlistItem[] = [];
const priceHistory: Map<string, number> = new Map();

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  // BUG: No user isolation — returns all items, not filtered by userId.
  // User A can see user B's wishlist.
  return wishlistStore;
}

export async function addItem(data: { userId: string; productId: string; productName: string; price: number }): Promise<WishlistItem> {
  // BUG: No deduplication — same item can be added twice.
  // Should check if productId already exists for this user.
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

export async function removeItem(userId: string, itemId: string): Promise<boolean> {
  const index = wishlistStore.findIndex(item => item.id === itemId && item.userId === userId);
  if (index === -1) return false;
  wishlistStore.splice(index, 1);
  return true;
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
    }
  }

  return changes;
}

// Mock price update
export async function updateProductPrice(productId: string, newPrice: number): Promise<void> {
  priceHistory.set(productId, newPrice);
}
