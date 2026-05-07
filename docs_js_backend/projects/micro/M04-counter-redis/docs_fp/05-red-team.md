# M04 Counter Redis: Red Team

## Attack 1: The Race Condition Flood

### Objective
Exploit the read-modify-write window to make the counter undercount.

### Method
Fire 1000 concurrent `POST /increment` requests at a counter starting at 0.

```bash
#!/bin/bash
for i in {1..1000}; do
  curl -X POST https://api.example.com/increment &
done
wait
```

### Expected Result (Buggy Code)
```javascript
const current = await redis.get('counter');
const next = parseInt(current, 10) + 1;
await redis.set('counter', next);
```

With 1000 concurrent requests, the final counter reads **~400-700** instead of 1000.

### Why It Works
Each request spends ~1ms between `GET` and `SET`. In that millisecond, dozens of other requests read the same value. They all write back the same incremented value.

### Defense
Use `redis.incr('counter')`. Atomic. No window.

---

## Attack 2: The Negative Inventory Purchase

### Objective
Buy items that do not exist by exploiting a non-atomic check-and-decrement.

### Method
Send 200 `POST /purchase` requests for a product with inventory = 10.

### The Vulnerable Code
```javascript
app.post('/purchase', async (req, res) => {
  const current = await redis.get('inventory:123');
  if (parseInt(current) > 0) {
    await redis.decr('inventory:123');
    res.json({ success: true });
  } else {
    res.status(409).json({ error: 'Out of stock' });
  }
});
```

### Expected Result
All 200 requests read `inventory > 0` before any of them decrement. You oversell by 190 units.

### Defense
Use a Lua script that checks and decrements atomically:

```lua
local current = tonumber(redis.call('GET', KEYS[1])) or 0
if current > 0 then
  redis.call('DECR', KEYS[1])
  return 1
else
  return 0
end
```

---

## Attack 3: The Key Deletion

### Objective
Crash the application by forcing it to parse a missing or malformed counter.

### Method
Delete the counter key mid-attack:

```bash
redis-cli DEL counter
# Immediately after, send a burst of increments
```

### The Vulnerable Code
```javascript
const current = await redis.get('counter');
const next = parseInt(current, 10) + 1; // current is null → NaN
```

`NaN + 1` is `NaN`. The counter becomes permanently poisoned.

### Defense
Handle null explicitly:
```javascript
const current = await redis.get('counter');
const next = (parseInt(current, 10) || 0) + 1;
```

Or use `INCR`, which treats a missing key as `0`.

---

## Attack 4: The Redis Denial of Service

### Objective
Make the counter unavailable by overwhelming Redis with connections.

### Method
Open 50,000 idle connections to Redis without closing them:

```javascript
const sockets = [];
for (let i = 0; i < 50000; i++) {
  const redis = new Redis({ lazyConnect: false });
  sockets.push(redis);
}
```

Redis default `maxclients` is 10,000. Legitimate requests get `ERR max number of clients reached`.

### Defense
- Use connection pooling (e.g., `ioredis` with `enableOfflineQueue: false`).
- Set `maxclients` appropriately.
- Monitor connection count and alert.

---

## Attack 5: The Integer Overflow

### Objective
Crash or corrupt the counter by pushing it past JavaScript's safe integer limit.

### Method
Rapidly increment a counter 9 quadrillion times. (In practice: find a forgotten analytics counter with no bounds checking.)

```javascript
// Poisoned by a bug elsewhere
await redis.set('counter', '99999999999999999999999');
const current = await redis.get('counter');
const next = parseInt(current, 10) + 1; // Infinity
```

### Defense
- Validate counter values before arithmetic.
- Use BigInt if counters can exceed `Number.MAX_SAFE_INTEGER`.
- Set Redis maxmemory policies to evict old data before abuse.

---

## Red Team Mindset

> The counter is not just a number. It is a **shared mutable state** in a hostile concurrency environment. Every assumption — "this will be fast enough," "the key will exist," "the value will be a number" — is an attack surface.

Your job as a defender is to make every operation so atomic and so defensive that even a malicious actor with perfect timing cannot break consistency.
