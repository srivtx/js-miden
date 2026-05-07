# M04 Counter Redis: Thinking Exercises

## Exercise 1: The Lottery

You are building a lottery system. Exactly 1,000,000 tickets exist. Users buy tickets one at a time via `POST /buy`.

**The buggy code:**
```javascript
const sold = await redis.get('tickets:sold');
if (parseInt(sold) < 1000000) {
  await redis.incr('tickets:sold');
  res.json({ ticket: await redis.incr('tickets:next') });
} else {
  res.status(409).json({ error: 'Sold out' });
}
```

**Questions:**
1. How many tickets could be oversold under heavy load?
2. Rewrite this using a single Lua script.
3. What happens if `tickets:sold` is deleted by a Redis admin mid-sale?

---

## Exercise 2: The Bank Transfer

You need to transfer 100 units from Account A to Account B. Both balances are stored in Redis.

**The naive code:**
```javascript
const balanceA = await redis.get('account:A');
const balanceB = await redis.get('account:B');
await redis.set('account:A', parseInt(balanceA) - 100);
await redis.set('account:B', parseInt(balanceB) + 100);
```

**Questions:**
1. What happens if the server crashes between the two `SET` operations?
2. Can you use `MULTI` / `EXEC`? What are the limitations?
3. How would you handle the case where Account A has insufficient funds?

---

## Exercise 3: The Analytics Pipeline

Your app tracks page views with `INCR pageviews:home`. Every hour, a cron job reads the value, writes it to a database, and resets the counter to 0.

**Questions:**
1. What happens if the cron job reads `1500`, then 100 more requests arrive, then the cron job resets to 0?
2. How would you make the "read and reset" operation atomic?
3. Is it acceptable to lose those 100 pageviews? When is approximate correctness good enough?

---

## Exercise 4: Distributed ID Generation

You need to generate unique, monotonically increasing IDs across 10 servers.

**Option A:** Each server has `redis.incr('global:id')`.
**Option B:** Each server pre-allocates a block of 1000 IDs: `redis.incrby('global:id', 1000)`.

**Questions:**
1. What is the latency difference between A and B under load?
2. What happens if a server allocates a block and then crashes before using all IDs?
3. Can you guarantee monotonicity without gaps?

---

## Exercise 5: The Inventory Reservation

A user adds an item to their cart. The item should be reserved for 15 minutes. If they do not check out, it returns to inventory.

**Questions:**
1. Which Redis data structure would you use to track reservations with automatic expiry?
2. How do you prevent double-reservation if the user clicks "Add to Cart" twice?
3. What happens if the reservation expires and the user tries to check out anyway?

---

## Exercise 6: Design Review

You are reviewing a teammate's code:

```javascript
async function awardPoints(userId, points) {
  const key = `user:${userId}:points`;
  const current = await redis.get(key);
  const next = (parseInt(current) || 0) + points;
  await redis.set(key, next);
  return next;
}
```

**Questions:**
1. Identify the exact line where the bug lives.
2. What is the minimum test scenario that would expose this bug?
3. How would you fix it without changing the function signature?

---

## Discussion Prompts

1. **When is eventual consistency acceptable for a counter?** Can you think of real-world counters where "mostly correct" is fine?

2. **Redis is single-threaded. Is that a limitation or a feature?** Defend both sides.

3. **If you could only use one Redis command for the rest of your career, which one would you choose?** Why?

4. **What is the difference between a race condition and a deadlock?** Can you create a deadlock using only Redis counters?
