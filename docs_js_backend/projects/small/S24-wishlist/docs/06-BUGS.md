# 06-BUGS.md

## Bug 1: No Deduplication

**Location:** `src/service.ts`, `addItem()` function, lines 19-28

**Current Code:**
```typescript
const item: WishlistItem = {
  id: generateId(),
  userId: data.userId,
  productId: data.productId,
  // ...
};

wishlistStore.push(item);  // No check for existing item!
```

**Real-World Impact:**

### Scenario: Double-Click on "Add to Wishlist"
User clicks the heart icon. The frontend sends two requests due to a debounce bug or network retry.

- **Current behavior**: Two identical entries in the wishlist
- **User impact**: "Why is this item here twice? This app is broken."
- **Business impact**: Support tickets, app store negative reviews
- **Analytics impact**: Wishlist count inflated, conversion rate calculations skewed

### Scenario: Sync Across Devices
User adds an item on mobile, then opens the web app. The web app syncs and adds the item again.

- **Current behavior**: Duplicate entries across platforms
- **User impact**: Confusion about which list is "real"
- **Business impact**: Reduced trust in cross-platform experience

### Scenario: Marketing "Saved Items" Campaign
Marketing team runs a campaign targeting users with 5+ wishlist items. A user with 3 real items and 4 duplicates is incorrectly included.

- **Current behavior**: Duplicate inflation triggers campaign
- **Business impact**: Wasted ad spend, lower ROI, annoyed users

**Severity:** MEDIUM — Degrades UX and pollutes data

**Fix:** Check for existing item before insert.

```typescript
const exists = wishlistStore.find(
  item => item.userId === data.userId && item.productId === data.productId
);
if (exists) {
  throw new Error('Item already in wishlist');
}
```

**Production fix:** Database composite unique constraint:
```sql
CREATE TABLE wishlist_items (
  user_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  -- ...
  UNIQUE(user_id, product_id)
);
```

---

## Bug 2: No User Isolation

**Location:** `src/service.ts`, `getWishlist()` function, lines 11-13

**Current Code:**
```typescript
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  // BUG: No user isolation — returns all items, not filtered by userId.
  return wishlistStore;
}
```

**Real-World Impact:**

### Scenario: URL Manipulation
User A is logged in and viewing `/wishlist/user-a`. They change the URL to `/wishlist/user-b`.

- **Current behavior**: Sees User B's entire wishlist
- **User B's data exposed**: Product preferences, price sensitivity, potential gift ideas
- **Business impact**: GDPR data breach. Fine: up to 4% of global revenue or €20M.
- **Reputation impact**: News headline: "[Your App] Leaks User Shopping Data"

### Scenario: Competitive Intelligence
Competitor scrapes your API, iterating through user IDs to collect wishlist data.

- **Current behavior**: Mass data extraction with no authentication
- **Impact**: Competitor builds product recommendation engine from your users' preferences
- **Business impact**: Loss of competitive advantage, potential IP theft

### Scenario: Stalking / Harassment
Malicious user discovers a victim's user ID and monitors their wishlist for gift purchases.

- **Current behavior**: Real-time access to victim's shopping intentions
- **Impact**: Stalking, doxxing, physical safety risk
- **Legal impact**: Potential liability under privacy and safety laws

**Severity:** CRITICAL — Privacy violation with legal and reputational consequences

**Fix:** Filter by userId in every data access.

```typescript
export async function getWishlist(userId: string): Promise<WishlistItem[]> {
  return wishlistStore.filter(item => item.userId === userId);
}
```

**Production fix:** Authorization middleware + database filtering:
```typescript
// Middleware
function requireOwnership(req, res, next) {
  if (req.user.id !== req.params.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

// Query
SELECT * FROM wishlist_items WHERE user_id = $1
```

---

## Additional Bug Surface

### No Authorization on Delete
The `removeItem` endpoint checks `userId` but the `getWishlist` endpoint does not. Inconsistent authorization is worse than none—it creates a false sense of security.

**Fix:** Apply the same authorization check to ALL endpoints.

### No Pagination
`GET /wishlist/:userId` returns all items. A power user with 500 wishlisted items gets a massive JSON response.

**Fix:** Add `limit` and `offset` query parameters. Default `limit` to 50.
