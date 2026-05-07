# Fundamentals: Atomicity Without Redis

**Task:** Build an atomic counter using only Node.js built-ins. No Redis.

You have a single server. Multiple requests arrive simultaneously.

---

## Multiple Choice: JavaScript Atomicity

**Q:** Is `count++` atomic in JavaScript?

**A)** Yes. JavaScript is single-threaded.

**B)** No. Even single-threaded code can have race conditions with async operations.

**C)** Yes, if you use `Atomics.add()`.

**D)** Only for primitive numbers, not objects.

**Think before reading on.**

---

## The Answer

**A is correct for synchronous code, but B is the real answer.**

JavaScript IS single-threaded. BUT:
- `count++` is 3 operations (read, increment, write)
- If you `await` between read and write, another request can interleave
- Even without await, if `count` is in shared memory (Worker Threads, SharedArrayBuffer), races occur

**For a single Node.js process handling HTTP requests:**
- Each request runs to completion before the next starts (event loop)
- `count++` IS atomic... unless you have async operations between read and write

**The real problem:** When you have multiple processes (PM2 cluster, multiple containers), each has its own memory.

---

## The File-Based Atomic Counter

Without Redis, you could use file locking:

```javascript
import { readFileSync, writeFileSync } from 'node:fs';
import { lockSync, unlockSync } from 'proper-lockfile'; // No, no libraries!
```

**Actually, without libraries, you'd need:**
- POSIX file locking (`flock`) via native addons
- Or atomic rename operations
- Or a single Node.js process with a queue

**The realization:** Distributed atomicity is HARD. Redis exists because file locking is a nightmare.
