# M04 Counter Redis: Three Wrongs

## Wrong #1: In-Memory Counter

### The Code
```javascript
let count = 0;

app.post('/increment', (req, res) => {
  count = count + 1;
  res.json({ count });
});
```

### Why It Feels Right
- It is the first thing you learned in programming.
- It is fast. No network call.
- It works perfectly on your laptop.

### Why It Is Wrong
| Problem | Consequence |
|---------|-------------|
| Not shared across instances | Load balancer rounds robin; user sees random values |
| Lost on restart | Deployment resets the counter to zero |
| No persistence | Crash = data loss |

### The Realization
> "I deployed two servers and now the counter jumps backward."

---

## Wrong #2: File-Based Counter

### The Code
```javascript
const fs = require('fs');

app.post('/increment', (req, res) => {
  const current = parseInt(fs.readFileSync('counter.txt', 'utf8'), 10);
  fs.writeFileSync('counter.txt', String(current + 1));
  res.json({ count: current + 1 });
});
```

### Why It Feels Right
- Files are shared across processes on the same machine.
- "Disk is persistent."
- No external dependency like Redis.

### Why It Is Wrong
| Problem | Consequence |
|---------|-------------|
| Read and write are separate system calls | Race condition: two processes read `5`, both write `6` |
| Disk I/O is slow | 1000 req/s = 1000 disk writes/sec. SSDs cry. |
| Not shared across machines | Scale horizontally? Now you have N files. |
| File corruption risk | Power loss mid-write = garbage data |

### The Realization
> "I added locking with `flock` and now my API is slower than a spreadsheet."

---

## Wrong #3: Redis Read-Modify-Write

### The Code
```javascript
app.post('/increment', async (req, res) => {
  const current = await redis.get('counter');
  const next = parseInt(current || '0', 10) + 1;
  await redis.set('counter', next.toString());
  res.json({ count: next });
});
```

### Why It Feels Right
- You are "using Redis correctly" — central state, fast, in-memory.
- The code is readable. It mirrors the mental model.
- It passes every unit test you write.

### Why It Is Wrong
| Problem | Consequence |
|---------|-------------|
| `GET` and `SET` are two separate commands | Any client can interleave between them |
| Race condition is silent | You only notice under load, and even then it looks like "slight inaccuracy" |
| Hard to reproduce | Requires concurrent requests to hit the exact same millisecond |

### The Realization
> "My load tests show the counter is 98% accurate. That is not a feature. That is a bug that only bites you on Black Friday."

---

## The Pattern

All three wrongs share the same root cause: **the gap between read and write**.

| Approach | Gap exists? | Shared? | Fast? | Correct? |
|----------|-------------|---------|-------|----------|
| In-memory | No (single thread) | ❌ No | ✅ Yes | ❌ No |
| File-based | ✅ Yes | ⚠️ Same machine | ❌ No | ❌ No |
| Redis RMW | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| Redis `INCR` | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |

> The wrong solutions do not fail obviously. They fail **gradually and silently**, which makes them more dangerous than code that crashes.
