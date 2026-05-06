# 08-troubleshooting.md

## Can access other users' carts

**Cause:** Sequential cart IDs (`cart-1`, `cart-2`) are guessable.

**Fix:** Use `crypto.randomUUID()` for unpredictable IDs.

## Carts never delete

**Cause:** `cleanupExpiredCarts` is a no-op.

**Fix:** Implement Redis TTL or periodic cleanup job.

## Cart total is wrong

**Cause:** Price or quantity not updated correctly.

**Fix:** Recalculate total from items array on every mutation.

## Merge loses items

**Cause:** Guest cart deleted before merge completes.

**Fix:** Copy items first, then delete guest cart.
