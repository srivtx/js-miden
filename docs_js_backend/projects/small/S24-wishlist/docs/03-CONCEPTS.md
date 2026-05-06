# 03-CONCEPTS.md

## WHAT

A wishlist service that:
1. Lets users save products to a personal list
2. Prevents the same product from being added twice
3. Isolates each user's data from others
4. Tracks price changes on wishlisted items
5. Supports removing individual items

## WHY

| Without This Service | With This Service |
|---------------------|-------------------|
| Users see each other's wishlists (privacy breach) | Strict user isolation per request |
| Duplicate items clutter the UI | Composite unique constraint prevents duplicates |
| Anyone can modify any wishlist | Authorization ensures only owners can edit |
| No price drop alerts | Background price tracking enables notifications |
| Storage bloat from duplicates | One row per user-product pair |

## HOW

### Step 1: Add Item
```typescript
POST /wishlist
{
  "userId": "user-1",
  "productId": "prod-1",
  "productName": "Blue Widget",
  "price": 29.99
}
```

### Step 2: Enforce Deduplication
```typescript
const exists = wishlistStore.find(
  item => item.userId === data.userId && item.productId === data.productId
);
if (exists) {
  throw new Error('Item already in wishlist');  // Maps to 409 Conflict
}
```

### Step 3: Isolate by User
```typescript
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  return wishlistStore.filter(item => item.userId === userId);
}
```

### Step 4: Track Price Changes
```typescript
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

## WRONG vs RIGHT

### WRONG: No User Isolation
```typescript
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  return wishlistStore;  // Returns EVERYONE'S items!
}
```

### RIGHT: Filter by User
```typescript
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  return wishlistStore.filter(item => item.userId === userId);
}
```

### WRONG: No Deduplication
```typescript
export async function addItem(data: { userId, productId, ... }) {
  const item = { id: generateId(), ...data, addedAt: new Date() };
  wishlistStore.push(item);  // Duplicate!
  return item;
}
```

### RIGHT: Check Before Insert
```typescript
export async function addItem(data: { userId, productId, ... }) {
  const exists = wishlistStore.find(
    item => item.userId === data.userId && item.productId === data.productId
  );
  if (exists) {
    throw new Error('Item already in wishlist');
  }
  
  const item = { id: generateId(), ...data, addedAt: new Date() };
  wishlistStore.push(item);
  return item;
}
```

## ASCII: Data Flow

```
+--------+     +-----------+     +----------------+     +---------+
| Client |---->|  Express  |---->| Deduplication  |---->| Store   |
+--------+     |  Router   |     | Check          |     | (per    |
               +-----------+     +----------------+     | user)   |
                     |                |                 +---------+
                     v                v                      |
               +-----------+     +----------------+          |
               | GET /:uid |     | User Filter    |<---------+
               +-----------+     +----------------+
```

## ASCII: Privacy Breach

```
User A: /wishlist/user-a
   |
   v
[Server returns ALL items]
   |
   v
User A sees:
  - Blue Widget (theirs)
  - Red Gadget (User B's!)  <-- PRIVACY BREACH
  - Green Thing (User C's!) <-- PRIVACY BREACH
```
