# M04 Counter Redis: The Incident

## 9:47 AM — Black Friday Begins

You are the platform engineer for an e-commerce flash-sale site. At 9:47 AM, the countdown hits zero. One hundred thousand users slam the "Add to Cart" button.

Your inventory counter — the single source of truth for "150 limited-edition sneakers remaining" — starts behaving like a drunk accountant.

## The Symptom

Customers are furious:
- The site shows **"12 remaining"**
- A customer buys 1
- The site still shows **"12 remaining"**
- Then it shows **"8 remaining"**
- Then **"14 remaining"**
- Then **"SOLD OUT"** — but the warehouse reports 37 pairs still on the shelf

Your CFO calls. Your CEO calls. Your mom calls because she saw it on Twitter.

## The Logs

```
[09:47:01] POST /purchase → inventory=150 → 149
[09:47:01] POST /purchase → inventory=150 → 149   ← same millisecond
[09:47:01] POST /purchase → inventory=150 → 149   ← same millisecond
[09:47:02] POST /purchase → inventory=149 → 148
```

Three purchases. Inventory dropped by 1.

## The Architecture

You moved the counter to Redis last month. The code looks sane:

```javascript
const current = await redis.get('inventory:sneakers');
const next = parseInt(current, 10) - 1;
await redis.set('inventory:sneakers', next);
```

It works in staging. It works in unit tests. It fails under load.

## Root Cause

The read-modify-write pattern is **not atomic**. Under concurrent load:

1. **Request A** reads `150`
2. **Request B** reads `150` (before A writes back)
3. **Request A** computes `149`, writes `149`
4. **Request B** computes `149`, writes `149`
5. **Two sales. One decrement.**

At 1000 req/s, you lose ~30% of decrements. Inventory becomes fiction.

## The Fix (Hidden)

<details>
<summary>Click to reveal</summary>

Replace the read-modify-write with a single atomic operation:

```javascript
const remaining = await redis.decr('inventory:sneakers');
if (remaining < 0) {
  await redis.incr('inventory:sneakers'); // undo
  return res.status(409).json({ error: 'Out of stock' });
}
```

Redis `DECR` is atomic. No race condition. No lost sales.

For non-increment operations (e.g., "decrement by N"), use a Lua script:

```lua
local current = tonumber(redis.call('GET', KEYS[1])) or 0
local delta = tonumber(ARGV[1])
if current >= delta then
  redis.call('DECRBY', KEYS[1], delta)
  return current - delta
else
  return -1
end
```

</details>

## Post-Incident Review

| Question | Answer |
|----------|--------|
| Why didn't tests catch this? | Unit tests run sequentially. Race conditions require concurrency. |
| Why did it work in staging? | Staging had 2 req/min. Production had 10,000 req/s. |
| Why Redis and not a database row lock? | Row locks work but serialize all purchases. Redis `DECR` is ~100x faster. |
| What monitoring gap existed? | We tracked error rate, not "inventory drift." No alert for `sold != shipped`. |

## The Real Lesson

> Any operation that reads a value, computes a new value, and writes it back is a **time bomb**. The gap between read and write is where concurrency murders your data. If it needs to happen together, it must be **one operation**.
