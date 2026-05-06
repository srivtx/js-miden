# 08-troubleshooting.md

## Leaderboard query is slow

**Cause:** Full array scan on every request.

**Fix:** Use Redis Sorted Sets or database index on score.

## Higher score overwritten by lower

**Cause:** Unconditional overwrite in `submitScore`.

**Fix:** Compare scores: only update if `newScore > existingScore`.

## Daily/weekly filters wrong

**Cause:** Timezone or boundary calculation error.

**Fix:** Use UTC midnight, store period explicitly, or use Redis TTL.

## Duplicate users in leaderboard

**Cause:** Multiple entries per user not aggregated.

**Fix:** Store only highest score per user per period.
