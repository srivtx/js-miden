# Three Wrong Ways to Count

---

## Wrong #1: Read-Modify-Write

```javascript
const current = await redis.get('counter');
const next = parseInt(current) + 1;
await redis.set('counter', next);
```

**Why it looks right:** Get the value, increment, save. Logical.

**Why it's wrong:** Two requests read 100. Both write 101. Lost update.

**Fix:** Use `INCR` (atomic):
```javascript
await redis.incr('counter');
```

---

## Wrong #2: Floating Point Counter

```javascript
let total = 0.1;
total += 0.2;
console.log(total); // 0.30000000000000004
```

**Why it looks right:** Numbers are numbers.

**Why it's wrong:** IEEE 754 floating point can't represent 0.1 + 0.2 exactly. For money or precise counts, this drifts.

**Fix:** Use integers. Store cents, not dollars.

---

## Wrong #3: In-Memory Counter with No Persistence

```javascript
const counts = new Map();

app.post('/click', (req, res) => {
  const key = req.body.campaignId;
  counts.set(key, (counts.get(key) || 0) + 1);
});
```

**Why it looks right:** Fast. No database round-trip.

**Why it's wrong:**
- Server restarts = data lost
- Multiple servers = inconsistent data
- No durability guarantee

**Fix:** Redis, database, or write-ahead log.
