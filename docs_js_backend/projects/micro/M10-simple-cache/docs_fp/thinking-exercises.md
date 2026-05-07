# Thinking Exercises

## 1. The Invalidation Problem

You cache user profiles for 1 hour. A user updates their profile. Another user views their profile 5 minutes later.

**Question:** Do you serve stale data or invalidate the cache? What's the trade-off?

---

## 2. The Distributed Cache

You have 5 API servers. Each has its own in-memory cache. User A hits server 1, then server 2.

**Question:** How do you keep caches consistent across servers?

---

## 3. The Cache Stampede

A popular cache entry expires. 1000 requests arrive simultaneously. All 1000 miss the cache and hit the database.

**Question:** How do you prevent this? (Hint: There are 3 common strategies.)

---

## 4. The Size Limit

Your cache has a 100MB limit. A single cached item is 50MB (a large report).

**Question:** Should you cache it? What if 3 users request different 50MB reports?

---

## 5. The Write Strategy

You update a user in the database. When do you update the cache?

- **Write-through:** Update cache simultaneously
- **Write-around:** Delete from cache, let next read repopulate
- **Write-back:** Update cache only, flush to DB later

**Question:** When does each strategy fail catastrophically?
