# 04-OLD-VS-NEW.md

## 2015 Approach (Shared / No Isolation)

### Architecture
- Single shared array for all wishlist items
- No deduplication check
- `userId` used as a display field, not a security boundary
- No database constraints

### Code Pattern
```javascript
// 2015-style: One big bucket, no rules
var wishlistStore = [];

function addItem(data) {
  wishlistStore.push(data);  // Anyone's data, no checks
}

function getWishlist(userId) {
  return wishlistStore;  // Returns everything!
}
```

### Problems
- User A sees User B's wishlist (privacy violation)
- Same item added 10 times (UX disaster)
- No way to enforce business rules at the database level
- GDPR non-compliance (Article 32 technical measures)

---

## 2025 Approach (Isolated / Constrained)

### Architecture
- Data partitioned by userId at the query level
- Composite unique constraint `(user_id, product_id)`
- Row-level security or tenant-scoped queries
- Authorization middleware validates ownership

### Code Pattern
```typescript
// 2025-style: Isolated, constrained, secure
async function addItem(data: { userId, productId, ... }) {
  // Check for duplicate
  const exists = await db.query(
    'SELECT 1 FROM wishlist_items WHERE user_id = $1 AND product_id = $2',
    [data.userId, data.productId]
  );
  
  if (exists.rows.length > 0) {
    throw new ConflictError('Item already in wishlist');
  }
  
  await db.query(
    'INSERT INTO wishlist_items (user_id, product_id, ...) VALUES ($1, $2, ...)',
    [data.userId, data.productId, ...]
  );
}

async function getWishlist(userId: string) {
  // Enforce isolation at database layer
  const result = await db.query(
    'SELECT * FROM wishlist_items WHERE user_id = $1',
    [userId]
  );
  return result.rows;
}
```

### Advantages
- Privacy: Users only see their own data
- UX: Duplicates impossible by design
- Security: Database enforces constraints even if application code is bypassed
- Compliance: GDPR Article 32 technical measures satisfied
- Performance: Indexed `(user_id, product_id)` lookup is O(log n)

## ASCII: Data Model Comparison

```
2015 (Shared Array)                         2025 (Per-User + Constraint)
===================                         ============================

[{                                            user_1:
  userId: "a", productId: "p1"                 ├── prod-1: Blue Widget
}, {                                           ├── prod-2: Red Gadget
  userId: "b", productId: "p2"                 └── prod-3: (blocked by
}, {                                               UNIQUE constraint)
  userId: "a", productId: "p1"  <-- DUPLICATE
}]
                                              user_2:
Query: filter(userId="a")                     ├── prod-4: Green Thing
Returns: [p1, p1]  <-- duplicates!            └── prod-5: Yellow Item

                                              Query: SELECT * WHERE user_id = 'a'
                                              Returns: [p1, p2]  <-- correct, deduped
```
