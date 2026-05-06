# 09-bugs.md

## Bug 1: No Deduplication

**Location:** `src/service.ts` in `addItem()`

**Issue:** The same product can be added to a user's wishlist multiple times, creating duplicate entries.

**Impact:**
- Cluttered wishlist UI
- Multiple price alerts for same product
- Wasted storage

**Fix:**
```typescript
const exists = wishlistStore.find(
  item => item.userId === data.userId && item.productId === data.productId
);
if (exists) {
  throw new Error('Item already in wishlist');
}
```

Add database constraint: `UNIQUE(user_id, product_id)`.

## Bug 2: No User Isolation

**Location:** `src/service.ts` in `getWishlist()`

**Issue:** Returns the entire shared array instead of filtering by userId. Any user can view any other user's wishlist by guessing/changing the URL.

**Impact:**
- Privacy violation
- Competitive intelligence leak
- GDPR/privacy law non-compliance

**Fix:**
```typescript
return wishlistStore.filter(item => item.userId === userId);
```

Always enforce authorization: verify the authenticated user matches the requested `userId`.
