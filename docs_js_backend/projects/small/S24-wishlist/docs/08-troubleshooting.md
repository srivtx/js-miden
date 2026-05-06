# 08-troubleshooting.md

## Same item appears multiple times

**Cause:** No deduplication check on add.

**Fix:** Check `userId + productId` uniqueness, return 409.

## User sees others' wishlists

**Cause:** `getWishlist` returns all items unfiltered.

**Fix:** Filter by `userId` parameter.

## Price changes not detected

**Cause:** Price history not updated when product price changes.

**Fix:** Call `updateProductPrice()` when external price feed updates.

## Wishlist empty after add

**Cause:** Wrong userId in GET request vs POST body.

**Fix:** Use authenticated session instead of path parameter.
