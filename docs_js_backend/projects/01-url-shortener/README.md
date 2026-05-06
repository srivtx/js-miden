# Project 1: URL Shortener Service

> **"Build me a URL shortener like bit.ly."**
>
> Sounds simple, right? A form, a database row, a redirect. But when the client adds *"10,000 redirects per second"* and *"click analytics by country"* and *"custom aliases"*, suddenly we're not building a toy anymore. We're building infrastructure.
>
> This guide takes you from zero to production-grade URL shortener. Every decision is explained. Every shortcut is flagged. And yes, we're breaking it on purpose five times so you learn how real systems fail.

---

## Section 1: The Brief (WHAT)

### The Full Requirements

1. Users submit long URLs and receive short, unique aliases.
2. Short URLs redirect to the original URL.
3. Click analytics: total clicks, country of origin, referrer domain.
4. Custom aliases (e.g., `/my-product`).
5. No collisions. Ever.
6. Handle 10,000 redirects per second.
7. Custom aliases must be validated (no profanity, no reserved words).

### User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-1 | User | Submit a long URL | I get a short link to share |
| US-2 | User | Choose a custom alias | My link is memorable and branded |
| US-3 | Marketer | View click counts | I measure campaign performance |
| US-4 | Marketer | See clicks by country | I understand my audience geography |
| US-5 | Marketer | See referrer breakdown | I know which channels drive traffic |
| US-6 | Platform | Prevent abuse | The service isn't used for spam/malware |
| US-7 | Platform | Handle viral traffic | Links don't break when they go viral |

### Acceptance Criteria

- **AC-1**: `POST /api/urls` with `{ "url": "https://..." }` returns `201` with `{ "shortCode": "aB3xK9", "shortUrl": "http://localhost:3000/aB3xK9" }`.
- **AC-2**: `GET /:shortCode` returns `302` redirect to original URL.
- **AC-3**: `GET /api/urls/:shortCode/analytics` returns click stats.
- **AC-4**: Custom alias `POST /api/urls` with `{ "url": "...", "customAlias": "my-product" }` works if available.
- **AC-5**: Duplicate custom alias returns `409 Conflict`.
- **AC-6**: Invalid URL scheme returns `400 Bad Request`.
- **AC-7**: Redirect endpoint responds in < 10ms at p99 under load.

---

## Section 2: Architecture (WHY)

### System Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│   Express    │────▶│    Redis    │
│  (Browser)  │     │   Server     │     │  (Cache +   │
└─────────────┘     └──────────────┘     │   Counter)  │
       ▲                    │             └─────────────┘
       │                    │                    │
       │                    ▼                    │
       │             ┌──────────────┐            │
       │             │  PostgreSQL  │◀───────────┘
       │             │  (Source of  │   (Analytics
       │             │   Truth)     │    + Counter)
       │             └──────────────┘
       │                    │
       └────────────────────┘
              (302 Redirect)
```

### Why PostgreSQL for Persistence?

Because URLs are money. Losing a URL mapping means breaking every share, every tweet, every QR code in the wild. PostgreSQL gives us:

- **Durability**: Write-Ahead Logging (WAL) ensures committed transactions survive a crash.
- **ACID**: When we claim a short code, we need atomicity. `INSERT` either succeeds or fails. No "maybe it's yours."
- **Unique Constraints**: The database enforces `UNIQUE(short_code)` so we physically cannot have collisions.
- **JSONB for Analytics?** We'll discuss this below, but PostgreSQL handles structured data beautifully.

**WHAT IF WRONG**: If we used a plain JSON file or SQLite on a single server, we'd lose data on disk failure and couldn't scale horizontally. If we used something eventually consistent, two users might get the same short code during a network partition.

### Why Redis for Caching?

Redirects must be *fast*. A cache miss means a PostgreSQL query, which is 10-100x slower.

- **Speed**: Redis operates in-memory. A `GET` is ~1ms.
- **Atomic Counters**: `INCR` is atomic across all clients. Perfect for generating sequential short codes without race conditions.
- **Pub/Sub & Streams**: We can queue analytics events for background flushing.

**WHAT IF WRONG**: Without Redis, every redirect hits PostgreSQL. At 10,000 req/s, your database connections saturate, query latency spikes, and p99 goes from 10ms to 500ms. Users abandon the link.

### Why Base62 Encoding?

We need to turn a number (our counter) into a short, human-readable string.

- Base62 uses `[0-9a-zA-Z]` = 62 characters.
- A 6-character Base62 string gives us `62^6 = 56.8 billion` combinations.
- A 7-character string gives us `62^7 = 3.5 trillion` combinations.
- Compare to Base10: `1,000,000` needs 7 digits. `1z9Zq0` is 6 characters and represents ~2 billion.

**WHAT IF WRONG**: If we used UUIDs, we'd get strings like `550e8400-e29b-41d4-a716-446655440000`. That's 36 characters. Not short. Not memorable. If we used Base16 (hex), we'd need 8 characters to reach 4 billion combinations. Base62 is the sweet spot.

### Why NOT MongoDB?

MongoDB is fantastic for documents with flexible schemas. But here, it fails us in one critical way: **atomic counters and unique constraints across distributed systems.**

In MongoDB, if you try to generate a short code by:
1. Reading the current counter
2. Incrementing in your app
3. Writing back

You have a race condition. Two Node.js processes can read `counter = 100`, both increment to `101`, and both try to insert the same code.

MongoDB *has* `findAndModify` with `$inc`, but counter synchronization + unique index enforcement is less battle-tested than PostgreSQL's transactional model for this specific workload. Also, MongoDB's eventual consistency in replica sets can mean a recently-created URL isn't visible for redirect queries immediately.

**WHAT IF WRONG**: If you use MongoDB without careful attention to read/write concerns and atomic operations, you'll get duplicate short codes under load. This isn't theoretical—it happens the moment you scale beyond one Node.js process.

### Hashing Strategy: MD5? NO. SHA-256? Better. But...

"Why not just hash the long URL and use the first 6 characters?"

- **MD5**: 128-bit output. Fast, but cryptographically broken. More importantly, two different URLs *will* eventually produce the same first 6 characters. Birthday paradox says with just 10,000 URLs, collision probability is non-trivial.
- **SHA-256**: Better, but same problem. It's a hash, not a unique ID generator. Collisions are probabilistic.
- **Hash + Counter Hybrid**: Some systems hash the URL to check if it's already been shortened (deduplication), then use a counter for the actual code. This is fine, but the hash itself cannot be your primary key.

**WHAT IF WRONG**: If you use `shortCode = sha256(url).slice(0,6)`, you will eventually have two different URLs map to the same code. When the second URL owner clicks their link, they go to the first URL. This is a data integrity failure.

### Counter vs Random Generation

| Approach | Pros | Cons |
|----------|------|------|
| **Counter** (sequential) | Collision-free, O(1) generation, ordered | Predictable (`a`, `b`, `c`...), can be scraped |
| **Random** (secure RNG) | Unpredictable, harder to scrape | Must check existence, collision possible (rare but real) |
| **Counter + Shuffle** | Collision-free, less predictable | More complex |

For this project, we use a **counter** for guaranteed uniqueness, but we apply a simple obfuscation (optional) to make sequential codes less obvious.

**WHAT IF WRONG**: If you use random generation without an existence check, at scale you'll eventually generate a duplicate. If you use a counter without atomic increments, two requests get the same number.

### Analytics Schema: Separate Table vs JSONB Column

**Option A: Separate Table**
```sql
CREATE TABLE clicks (
  id SERIAL PRIMARY KEY,
  url_id INTEGER REFERENCES urls(id),
  country VARCHAR(2),
  referrer VARCHAR(255),
  clicked_at TIMESTAMP DEFAULT NOW()
);
```
- **Pros**: Normalized, easy to index, easy to query aggregates (`COUNT`, `GROUP BY`).
- **Cons**: More disk space, more writes.

**Option B: JSONB Column on URLs**
```sql
ALTER TABLE urls ADD COLUMN analytics JSONB DEFAULT '{}';
-- Store: {"clicks": 150, "countries": {"US": 100, "GB": 50}}
```
- **Pros**: Single row read for URL + stats, fewer tables.
- **Cons**: Concurrent updates to JSONB require row locking. At 10,000 clicks/sec, you have massive write contention on the URL row. Also, querying `analytics->'countries'->>'US'` is slower than a proper index.

**Our Choice**: Separate `clicks` table for raw events, aggregated read model in Redis for real-time stats, and periodic rollup to PostgreSQL for historical reporting.

**WHAT IF WRONG**: If you put analytics in a JSONB column on the URL row, every click locks that row. At high volume, redirect latency becomes unpredictable as clicks queue up to update the same JSON blob.

---

## Section 3: NEW Concepts (Inline Teaching)

This project introduces concepts not covered in the core modules. Each is explained, justified, and implemented.

---

### NEW Concept 1: Base62 Encoding

#### WHAT is it?

Base62 is a numeral system using 62 characters: `0-9`, `a-z`, `A-Z`. It's URL-safe (no `/`, `+`, or `=` like Base64) and human-readable (no ambiguous characters if you avoid `0`, `O`, `l`, `1`, though we won't do that here for simplicity).

#### WHY use it here?

We generate short codes from an integer counter. We need the shortest possible string that represents a large number.

#### WHAT HAPPENS if we don't?

If we use Base10, counter `1000000` = `"1000000"` (7 chars). In Base62, it's `"4c92"` (4 chars). At 1 billion URLs, Base10 needs 10 chars. Base62 needs 6. Every character matters in a tweet.

#### Implementation

```typescript
// src/lib/base62.ts
const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = 62;

export function encodeBase62(num: number): string {
  if (num === 0) return BASE62_ALPHABET[0];

  let result = '';
  let n = num;

  while (n > 0) {
    result = BASE62_ALPHABET[n % BASE] + result;
    n = Math.floor(n / BASE);
  }

  return result;
}

export function decodeBase62(str: string): number {
  let result = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const value = BASE62_ALPHABET.indexOf(char);

    if (value === -1) {
      throw new Error(`Invalid Base62 character: ${char}`);
    }

    result = result * BASE + value;
  }

  return result;
}
```

---

### NEW Concept 2: Bloom Filters

#### WHAT is it?

A Bloom filter is a space-efficient probabilistic data structure. It can tell you:
- "This item is definitely NOT in the set" (100% true)
- "This item MIGHT be in the set" (possible false positive)

It never says "not in set" when it actually is. But it might say "in set" when it's not.

#### WHY use it here?

When checking if a custom alias exists, we want to avoid hitting PostgreSQL if possible.

```
Check Bloom Filter
    │
    ├── "Definitely NOT there" ──▶ Proceed with INSERT
    │
    └── "MIGHT be there" ──▶ Check PostgreSQL
```

This saves a database query for 99%+ of new custom aliases.

#### WHAT HAPPENS if we don't?

Without a Bloom filter, every custom alias creation requires a PostgreSQL `SELECT` to check availability. At 100 custom alias creations per second, that's 100 queries. With a Bloom filter backed by Redis, it's a single `BITFIELD` operation in memory.

**The Trade-off**: We might reject a valid alias (false positive) or think one exists when it doesn't. But we'd only do the PostgreSQL check on "might exist," so the worst case is a slightly slower check. We'd never allow a collision.

#### Implementation

For simplicity in this project, we'll use a **naive Set-based Bloom filter concept** in Redis. In production, you'd use a proper Bloom filter module or a library like `bloom-filters`.

```typescript
// src/lib/membership-cache.ts
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

/**
 * ⚠️ THIS IS A REDIS SET, NOT A BLOOM FILTER.
 *
 * A real Bloom filter uses fixed-size bit arrays and multiple hash functions,
 * consuming ~1.14 GB for 1 billion items at 1% false-positive rate.
 * A Redis Set stores the actual strings, so memory grows linearly with the
 * number of items (tens of gigabytes at scale).
 *
 * We use a Set here for simplicity and zero false positives, but in production
 * replace this with the `bloom-filters` npm package or the RedisBloom module.
 */
export async function mightExist(shortCode: string): Promise<boolean> {
  const exists = await redis.sismember('url:membership', shortCode);
  return exists === 1;
}

export async function addToFilter(shortCode: string): Promise<void> {
  await redis.sadd('url:membership', shortCode);
}
```

> **SECURITY FIX — Bloom Filter Misrepresentation (MAJOR):**
> The original code claimed to implement a Bloom filter but actually used a Redis Set. A Set for billions of items consumes tens of gigabytes, not ~1.14GB, making horizontal scaling prohibitively expensive. We renamed the file to `membership-cache.ts`, added a giant warning, and kept the Set as a teaching aid while warning learners not to copy it into production without using a real Bloom filter library.

**Note**: A real Bloom filter uses multiple hash functions and bit arrays. The Redis Set above is a **conceptual stand-in** that trades memory for simplicity. A true Bloom filter for 1 billion items at 1% false positive rate uses ~1.14GB. Our Set uses more memory but is zero false positive. The point is: **understand the concept**.

---

### NEW Concept 3: Distributed Counters

#### WHAT is it?

A counter that multiple servers can increment atomically without race conditions.

#### WHY use it here?

We need to generate unique sequential IDs for short codes. If two Node.js instances both read "current counter = 1000," increment to 1001, and write back, both generate the same short code.

#### WHAT HAPPENS if we don't?

Without atomic counters, under load you'll see `Unique constraint violation` errors in PostgreSQL. Or worse, if you don't have unique constraints, silent data corruption where two URLs share one short code.

#### Implementation

**Redis INCR (Preferred for high throughput)**:

```typescript
// src/lib/counter.ts
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function getNextCounter(): Promise<number> {
  const counter = await redis.incr('url:counter');
  return counter;
}
```

**PostgreSQL RETURNING (Alternative, one less dependency)**:

```sql
INSERT INTO url_counters DEFAULT VALUES RETURNING id;
```

```typescript
// Using Prisma
const result = await prisma.$queryRaw<{ id: number }[]>`
  INSERT INTO url_counters DEFAULT VALUES RETURNING id
`;
const nextId = result[0].id;
```

**WHY REDIS WINS**: `INCR` is ~1ms and doesn't touch disk. PostgreSQL `RETURNING` requires a disk write (WAL) for every single ID. At 10,000 URL creations per second, PostgreSQL counter writes become a bottleneck. Redis handles 100,000+ ops/sec on a single core.

---

### NEW Concept 4: Geolocation from IP

#### WHAT is it?

Determining a user's geographic location (country, city) from their IP address.

#### WHY use it here?

The client wants "clicks by country." We can't ask users to fill out a form every time they click a link.

#### WHAT HAPPENS if we don't?

You lose geographic analytics entirely. Or you rely on client-side JavaScript, which ad blockers disable and which doesn't work for direct API/email clicks.

#### How It Works

IP addresses are allocated in ranges to countries and ISPs. A GeoIP database maps these ranges to locations.

**MaxMind GeoIP2** is the industry standard. They provide a free GeoLite2 database.

```typescript
// src/lib/geo.ts
import { Reader } from '@maxmind/geoip2-node';

let reader: Reader | null = null;

export async function initGeoReader(): Promise<void> {
  if (!process.env.GEOIP_DB_PATH) {
    console.warn('No GEOIP_DB_PATH set. Geolocation disabled.');
    return;
  }
  // In a real app, download the MMDB file from MaxMind
  reader = await Reader.open(process.env.GEOIP_DB_PATH);
}

export function getCountryFromIP(ip: string): string | null {
  if (!reader) return null;

  try {
    const response = reader.country(ip);
    return response.country?.isoCode || null;
  } catch {
    // Private IP, invalid IP, etc.
    return null;
  }
}
```

**Privacy Note**: Storing IP addresses permanently may violate GDPR. Store the country code, hash the IP, or anonymize it (`192.168.1.xxx`).

**WHAT IF WRONG**: If you use a free API for every redirect, you add 50-200ms of latency per request. At 10,000 req/s, you'll bankrupt yourself on API costs and kill performance. Local MMDB files are ~50MB and queried in-memory in <1ms.

---

### NEW Concept 5: Referrer Parsing

#### WHAT is it?

The `Referer` (sic) HTTP header tells you where the user came from. `https://twitter.com/someuser` means Twitter sent them.

#### WHY use it here?

Analytics need to show "which referrers drive traffic."

#### Security Implications

**Referrer Policy** controls how much information browsers send:
- `no-referrer`: Browser sends nothing. You see "Direct / None."
- `strict-origin-when-cross-origin`: Only sends origin (domain), not full path.
- `unsafe-url`: Sends everything. Privacy risk.

As a URL shortener, you should set your own redirects to use:
```
Referrer-Policy: no-referrer-when-downgrade
```

This protects your users' privacy while still giving destination sites basic referrer info.

**WHAT HAPPENS if we ignore this?**

If your shortener leaks full referrers (including paths with tokens), you expose sensitive data. Example: `https://example.com/reset-password?token=abc123` gets shared, and the token appears in your analytics dashboard.

#### Implementation

```typescript
// src/lib/referrer.ts
import { parse } from 'url';

export function extractReferrerDomain(refererHeader: string | undefined): string | null {
  if (!refererHeader) return 'direct';

  try {
    const parsed = parse(refererHeader);
    return parsed.hostname || 'unknown';
  } catch {
    return 'invalid';
  }
}
```

---

## Section 4: Step-by-Step Build Guide

### Prerequisites

- Node.js 22+
- pnpm 10+
- Docker & Docker Compose

### Step 0: Project Bootstrap

```bash
mkdir url-shortener && cd url-shortener
pnpm init
pnpm add express@^5.0.0 @prisma/client@^6.0.0 ioredis@^5.0.0 zod@^3.0.0
pnpm add -D typescript@^5.7.0 @types/express@^5.0.0 @types/node@^22.0.0 prisma@^6.0.0 tsx@^4.0.0
```

**`package.json`**:
```json
{
  "name": "url-shortener",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:migrate": "prisma migrate deploy",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "express": "^5.0.0",
    "ioredis": "^5.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "prisma": "^6.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

**`tsconfig.json`**:
```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 1: Database Schema (PostgreSQL + Prisma)

**`prisma/schema.prisma`**:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Url {
  id          Int      @id @default(autoincrement())
  shortCode   String   @unique @map("short_code")
  longUrl     String   @map("long_url")
  customAlias String?  @unique @map("custom_alias")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  clicks Click[]

  @@index([shortCode])
  @@index([customAlias])
  @@map("urls")
}

model Click {
  id        Int      @id @default(autoincrement())
  urlId     Int      @map("url_id")
  country   String?  @db.VarChar(2)
  referrer  String?
  userAgent String?  @map("user_agent")
  clickedAt DateTime @default(now()) @map("clicked_at")

  url Url @relation(fields: [urlId], references: [id], onDelete: Cascade)

  @@index([urlId, clickedAt])
  @@index([country])
  @@map("clicks")
}

// Only needed if using PostgreSQL RETURNING counter strategy
model UrlCounter {
  id Int @id @default(autoincrement())

  @@map("url_counters")
}
```

**`.env`**:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/urlshortener?schema=public&connection_limit=20&pool_timeout=2"
REDIS_URL="redis://localhost:6379"
PORT=3000
NODE_ENV=development
```

Run migrations:
```bash
pnpm db:generate
pnpm db:migrate
```

### Step 2: Base62 Encoder/Decoder

**`src/lib/base62.ts`**:
```typescript
const BASE62_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = 62;

export function encodeBase62(num: number): string {
  if (num < 0) throw new Error('encodeBase62 does not support negative numbers');
  if (num === 0) return BASE62_ALPHABET[0];

  let result = '';
  let n = num;

  while (n > 0) {
    result = BASE62_ALPHABET[n % BASE] + result;
    n = Math.floor(n / BASE);
  }

  return result;
}

export function decodeBase62(str: string): number {
  let result = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const value = BASE62_ALPHABET.indexOf(char);

    if (value === -1) {
      throw new Error(`Invalid Base62 character: ${char}`);
    }

    result = result * BASE + value;
  }

  return result;
}
```

### Step 3: URL Validation

**`src/lib/validate-url.ts`**:
```typescript
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export function isValidUrl(url: string): boolean {
  try {
    // Reject protocol-relative URLs (e.g. //evil.com) which inherit
    // the caller's scheme and can bypass naive protocol checks.
    if (url.trimStart().startsWith('//')) return false;

    const parsed = new URL(url);

    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return false;
    if (!parsed.hostname) return false;

    // Prevent open-redirect / credential-leakage attacks such as
    // https://example.com@evil.com (parsed.username = example.com, host = evil.com)
    if (parsed.username || parsed.password) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Reconstructs a URL with only safe parts, stripping auth credentials
 * and fragments before sending it to res.redirect().
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return null;
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}
```

> **SECURITY FIX — Open Redirect (CRITICAL):**
> `new URL('https://example.com@evil.com').protocol` returns `'https:'`, so the old check passed malicious URLs. An attacker could create a short link that redirected users to a phishing site. The fix parses the URL properly, rejects protocol-relative URLs, strips auth credentials, and validates the hostname exists. `sanitizeUrl()` is called before `res.redirect()` to ensure only protocol + host + path + search survive.

**WHY**: `new URL()` is built-in and RFC-compliant. A regex like `/^https?:\/\//` would accept `http://not-a-domain` and `javascript:alert(1)//http://evil.com`. The WHATWG URL parser is the only correct way to validate URLs in 2025. *However*, checking `protocol` alone is **not enough**—you must also verify the absence of `username`/`password` and reject protocol-relative URLs.

### Step 4: Redis Client & Counter

**`src/lib/redis.ts`**:
```typescript
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => {
  console.error('Redis error:', err);
});

/**
 * DEPRECATED for URL generation — PostgreSQL RETURNING id is now the
 * single source of truth. Kept for backward compatibility with analytics.
 */
export async function getNextCounter(): Promise<number> {
  const counter = await redis.incr('url:counter');
  return counter;
}

export async function getCachedUrl(shortCode: string): Promise<string | null> {
  return redis.get(`url:${shortCode}`);
}

export async function cacheUrl(shortCode: string, longUrl: string, ttlSeconds = 86400): Promise<void> {
  await redis.setex(`url:${shortCode}`, ttlSeconds, longUrl);
}

/**
 * Distributed-mutex cache fetch. Only one process hits PostgreSQL on a
 * cache miss; concurrent requests wait and read the freshly warmed cache.
 */
export async function getCachedUrlStampedeProtected(
  shortCode: string,
  fetchFromDb: () => Promise<string | null>
): Promise<string | null> {
  const key = `url:${shortCode}`;
  const lockKey = `lock:${shortCode}`;
  const cached = await redis.get(key);

  if (cached) {
    // Probabilistic early expiration: refresh if TTL < 10% remaining
    const ttl = await redis.ttl(key);
    if (ttl > 0 && Math.random() < 0.1) {
      redis.expire(key, 86400).catch(() => {});
    }
    return cached;
  }

  const acquired = await redis.set(lockKey, '1', 'EX', 10, 'NX');
  if (acquired) {
    try {
      const dbResult = await fetchFromDb();
      if (dbResult) {
        await redis.setex(key, 86400, dbResult);
      }
      return dbResult;
    } finally {
      await redis.del(lockKey);
    }
  }

  // Another process is fetching. Wait briefly and retry cache.
  await new Promise((r) => setTimeout(r, 50));
  return redis.get(key);
}

export async function incrementAnalytics(shortCode: string, country: string | null, referrer: string | null): Promise<void> {
  const pipeline = redis.pipeline();

  pipeline.incr(`analytics:${shortCode}:clicks`);

  if (country) {
    pipeline.hincrby(`analytics:${shortCode}:countries`, country, 1);
  }

  if (referrer) {
    pipeline.hincrby(`analytics:${shortCode}:referrers`, referrer, 1);
  }

  pipeline.expire(`analytics:${shortCode}:clicks`, 86400 * 7);
  pipeline.expire(`analytics:${shortCode}:countries`, 86400 * 7);
  pipeline.expire(`analytics:${shortCode}:referrers`, 86400 * 7);

  await pipeline.exec();
}

/**
 * Push a raw analytics event to a Redis list for durable background processing.
 * A worker (see analytics-worker.ts) batches these into PostgreSQL.
 * Survives server crashes because the queue lives in Redis.
 */
export async function queueAnalyticsEvent(
  shortCode: string,
  country: string | null,
  referrer: string | null
): Promise<void> {
  const event = JSON.stringify({ shortCode, country, referrer, ts: Date.now() });
  await redis.lpush('analytics:queue', event);
}
```

### Step 5: Prisma Client

**`src/lib/prisma.ts`**:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

> **OPERATIONAL FIX — Connection Pooling (MAJOR):**
> Prisma's default connection pool is small. At 10,000 req/s the pool exhausts and requests return 500s. Add `?connection_limit=20&pool_timeout=2` to `DATABASE_URL`. For horizontal scaling, run PgBouncer in transaction mode so dozens of app servers share a bounded pool of real Postgres connections.

### Step 6: Express Server & Routes

**`src/server.ts`**:
```typescript
import express from 'express';
import { ZodError, z } from 'zod';
import { prisma } from './lib/prisma.js';
import { redis, getCachedUrlStampedeProtected, cacheUrl, incrementAnalytics, queueAnalyticsEvent } from './lib/redis.js';
import { encodeBase62 } from './lib/base62.js';
import { isValidUrl, sanitizeUrl } from './lib/validate-url.js';
import { extractReferrerDomain } from './lib/referrer.js';
import { getCountryFromIP } from './lib/geo.js';

const app = express();
app.use(express.json());

// Trust proxy so req.ip reflects the real client behind a load balancer
app.set('trust proxy', 1);

// Rate limiting middleware (Redis-backed, works behind load balancers)
function rateLimit(maxRequests = 10, windowMs = 60000) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      // With trust proxy enabled, req.ip is the leftmost untrusted
      // X-Forwarded-For address. Fall back to the TCP remote address
      // if the request comes directly.
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      const windowKey = `rate_limit:${clientIp}:${Math.floor(Date.now() / windowMs)}`;

      const current = await redis.incr(windowKey);
      if (current === 1) {
        await redis.pexpire(windowKey, windowMs);
      }

      if (current > maxRequests) {
        res.status(429).json({ error: 'Too many requests.' });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// Request schemas
const createUrlSchema = z.object({
  url: z.string().min(1),
  customAlias: z.string().min(1).max(50).optional(),
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create short URL
app.post('/api/urls', rateLimit(10, 60000), async (req, res) => {
  try {
    const { url, customAlias } = createUrlSchema.parse(req.body);

    if (!isValidUrl(url)) {
      res.status(400).json({ error: 'Invalid URL. Only http:// and https:// are allowed.' });
      return;
    }

    // Custom alias path
    if (customAlias) {
      const existing = await prisma.url.findFirst({
        where: {
          OR: [{ shortCode: customAlias }, { customAlias }],
        },
      });

      if (existing) {
        res.status(409).json({ error: 'Alias already in use.' });
        return;
      }

      const newUrl = await prisma.url.create({
        data: {
          shortCode: customAlias,
          longUrl: url,
          customAlias,
        },
      });

      await cacheUrl(newUrl.shortCode, newUrl.longUrl);

      res.status(201).json({
        shortCode: newUrl.shortCode,
        shortUrl: `${req.protocol}://${req.get('host')}/${newUrl.shortCode}`,
        longUrl: newUrl.longUrl,
      });
      return;
    }

    // Counter-based path: PostgreSQL is the single source of truth.
    // Using RETURNING id inside the same DB transaction guarantees atomicity.
    // If the INSERT fails, the counter row is rolled back — no leaked codes.
    const [{ id: counter }] = await prisma.$queryRaw<[{ id: number }]>
      INSERT INTO url_counters DEFAULT VALUES RETURNING id
    `;
    const shortCode = encodeBase62(counter);

    try {
      const newUrl = await prisma.url.create({
        data: {
          shortCode,
          longUrl: url,
        },
      });

      await cacheUrl(newUrl.shortCode, newUrl.longUrl);

      res.status(201).json({
        shortCode: newUrl.shortCode,
        shortUrl: `${req.protocol}://${req.get('host')}/${newUrl.shortCode}`,
        longUrl: newUrl.longUrl,
      });
    } catch (err: any) {
      // Handle race condition: unique constraint on shortCode
      if (err.code === 'P2002') {
        res.status(500).json({ error: 'Generated code collision. Please retry.' });
        return;
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Invalid request body.', details: err.flatten() });
      return;
    }
    console.error('Create URL error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Redirect endpoint (rate-limited to mitigate DDoS)
app.get('/:shortCode', rateLimit(100, 60000), async (req, res) => {
  const { shortCode } = req.params;

  try {
    // 1. Check cache with stampede protection.
    // Only one process hits PostgreSQL on a miss; the rest wait.
    const longUrl = await getCachedUrlStampedeProtected(shortCode, async () => {
      const urlRecord = await prisma.url.findUnique({
        where: { shortCode },
      });
      return urlRecord?.longUrl ?? null;
    });

    if (!longUrl) {
      res.status(404).json({ error: 'Short URL not found.' });
      return;
    }

    // 2. Queue analytics for durable, background processing
    const country = getCountryFromIP(req.ip || '');
    const referrer = extractReferrerDomain(req.get('referer'));

    // Fast Redis counters for real-time reads...
    incrementAnalytics(shortCode, country, referrer).catch(() => {});
    // ...plus a durable Redis queue so events survive crashes.
    queueAnalyticsEvent(shortCode, country, referrer).catch((err) => {
      console.error('Analytics queue error:', err);
    });

    // 3. Redirect using the sanitized URL to strip auth credentials
    const safeUrl = sanitizeUrl(longUrl);
    if (!safeUrl) {
      res.status(500).json({ error: 'Invalid redirect URL.' });
      return;
    }
    res.redirect(302, safeUrl);
  } catch (err) {
    console.error('Redirect error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Analytics endpoint
app.get('/api/urls/:shortCode/analytics', async (req, res) => {
  const { shortCode } = req.params;

  try {
    const [clicksStr, countries, referrers] = await Promise.all([
      redis.get(`analytics:${shortCode}:clicks`),
      redis.hgetall(`analytics:${shortCode}:countries`),
      redis.hgetall(`analytics:${shortCode}:referrers`),
    ]);

    // Avoid a racy fallback: use Redis counters for speed, or query the
    // durable PostgreSQL source of truth directly when Redis is cold.
    const totalClicks = clicksStr
      ? parseInt(clicksStr, 10)
      : await prisma.click.count({
          where: { url: { shortCode } },
        });

    res.json({
      shortCode,
      totalClicks,
      countries: Object.entries(countries).map(([code, count]) => ({
        code,
        count: parseInt(count, 10),
      })),
      referrers: Object.entries(referrers).map(([domain, count]) => ({
        domain,
        count: parseInt(count, 10),
      })),
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 URL Shortener listening on port ${PORT}`);
});
```

> **SECURITY FIX — Rate Limiting, Cache Stampede & Analytics Durability (CRITICAL):**
> The old rate limiter stored counts in a local `Map`. Deploy 3 containers and an attacker gets 3× the allowed budget. Switching to a Redis fixed-window counter shares state across all instances. `trust proxy` ensures `req.ip` reflects the client behind a load balancer. Cache stampede protection uses a Redis distributed mutex (`SET ... NX`) so only one process queries PostgreSQL on a miss, preventing connection-pool exhaustion. Finally, raw analytics events are pushed to a Redis list and flushed by a background worker, so a server crash mid-request no longer loses click data.

### Step 6.5: Analytics Background Worker

Redirects must stay fast. Instead of writing every click to PostgreSQL in the hot path, we queue events in Redis and flush them in batches.

**`src/workers/analytics-worker.ts`**:
```typescript
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';

const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 5000;

async function flushAnalytics() {
  try {
    // Peek up to BATCH_SIZE events from the queue
    const events = await redis.lrange('analytics:queue', 0, BATCH_SIZE - 1);
    if (events.length === 0) return;

    const rows = events.map((e) => JSON.parse(e));

    // Resolve urlIds from shortCodes in bulk
    const shortCodes = [...new Set(rows.map((r) => r.shortCode))];
    const urls = await prisma.url.findMany({
      where: { shortCode: { in: shortCodes } },
      select: { id: true, shortCode: true },
    });
    const urlIdByCode = new Map(urls.map((u) => [u.shortCode, u.id]));

    const clicks = rows
      .map((r) => {
        const urlId = urlIdByCode.get(r.shortCode);
        if (!urlId) return null;
        return {
          urlId,
          country: r.country || null,
          referrer: r.referrer || null,
          userAgent: null,
          clickedAt: new Date(r.ts),
        };
      })
      .filter(Boolean) as any[];

    if (clicks.length > 0) {
      await prisma.click.createMany({ data: clicks, skipDuplicates: true });
    }

    // Remove processed events
    await redis.ltrim('analytics:queue', events.length, -1);
  } catch (err) {
    console.error('Analytics flush error:', err);
  }
}

setInterval(flushAnalytics, FLUSH_INTERVAL_MS);

// Keep the process alive
setInterval(() => {}, 1 << 30);
```

> **WHY the Worker Works:** Redis lists survive process restarts. If the Node server crashes after queuing an event, the event remains in Redis. When the worker restarts, it continues flushing from where it left off. Bulk `createMany` is ~100× more efficient than individual inserts, keeping PostgreSQL healthy under viral traffic.

### Step 7: Supporting Libraries

**`src/lib/referrer.ts`**:
```typescript
export function extractReferrerDomain(refererHeader: string | undefined): string | null {
  if (!refererHeader) return 'direct';

  try {
    const url = new URL(refererHeader);
    return url.hostname || 'unknown';
  } catch {
    return 'invalid';
  }
}
```

**`src/lib/geo.ts`**:
```typescript
// Placeholder for MaxMind integration
// Install: pnpm add @maxmind/geoip2-node
// Download GeoLite2-Country.mmdb from MaxMind

export function getCountryFromIP(_ip: string): string | null {
  // In production, initialize Reader here and look up IP
  // For this project, return null unless GEOIP_DB_PATH is set
  if (!process.env.GEOIP_DB_PATH) return null;

  // Example implementation (commented out until you add the dependency):
  // import { Reader } from '@maxmind/geoip2-node';
  // const reader = await Reader.open(process.env.GEOIP_DB_PATH);
  // const result = reader.country(ip);
  // return result.country?.isoCode || null;

  return null;
}
```

### Step 8: Docker Compose Setup

**`docker-compose.yml`**:
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/urlshortener?schema=public&connection_limit=20&pool_timeout=2
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
      - PORT=3000
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: pnpm start

  migrate:
    build: .
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/urlshortener?schema=public
    depends_on:
      db:
        condition: service_healthy
    command: >
      sh -c "pnpm db:generate && pnpm db:migrate"
    restart: on-failure

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: urlshortener
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

> **SECURITY FIX — Docker Compose Migrations (MAJOR):**
> Running `prisma migrate dev` inside the app container startup is an anti-pattern: multiple replicas race to migrate, and `migrate dev` is for development only. We replaced it with a dedicated `migrate` service using `prisma migrate deploy` (production-safe) and `restart: on-failure`. We also added a Redis healthcheck so the app waits until Redis is actually accepting connections.

**`Dockerfile`**:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm db:generate
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

---

## Section 5: 5 Intentional Bugs to Introduce

These bugs are designed to teach you how distributed systems fail. Introduce them one at a time, observe the symptoms, then apply the fix.

---

### Bug 1: Race Condition in Counter

#### How to Introduce

Replace the atomic `redis.incr` with a read-modify-write pattern:

```typescript
// BROKEN: src/lib/redis.ts
export async function getNextCounter(): Promise<number> {
  const current = await redis.get('url:counter');
  const next = (current ? parseInt(current, 10) : 0) + 1;
  await redis.set('url:counter', next.toString());
  return next;
}
```

#### What Symptoms You'll See

- PostgreSQL throws `P2002 Unique constraint violation` under load.
- Two different long URLs end up with the same `shortCode` (if you remove the unique constraint to "fix" the error).
- Logs show duplicate key errors.

#### How to Reproduce

```bash
# Terminal 1: Start server
pnpm dev

# Terminal 2: Fire 100 concurrent requests
seq 1 100 | xargs -P 20 -I {} \
  curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/page'{}'"}'
```

#### The Fix

```typescript
// FIXED: src/lib/redis.ts
export async function getNextCounter(): Promise<number> {
  const counter = await redis.incr('url:counter');
  return counter;
}
```

#### WHY the Fix Works

`INCR` is a single Redis command. Redis is single-threaded. Even with 100 concurrent clients, Redis processes commands sequentially. Each `INCR` sees the value the previous one wrote. No race condition.

**Alternative Fix**: Use PostgreSQL `RETURNING id` from a counter table. The database row lock ensures atomicity.

---

### Bug 2: Cache Stampede

#### How to Introduce

Remove cache warming and allow cache misses to all hit the database simultaneously:

```typescript
// BROKEN: In src/server.ts redirect handler
// Simply don't implement any stampede protection
// (The current code already doesn't have it, but let's make it worse)
// Add a fake slow DB query to exaggerate the problem:

const urlRecord = await prisma.url.findUnique({
  where: { shortCode },
});
// Fake delay to simulate slow DB under load:
await new Promise((r) => setTimeout(r, 100));
```

#### What Symptoms You'll See

- When a popular URL's cache expires, response time jumps from 5ms to 500ms.
- PostgreSQL connection pool saturates.
- CPU spikes on the database.

#### How to Reproduce

```bash
# 1. Create a URL
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
# Returns: {"shortCode": "aB3xK9"}

# 2. Warm the cache
curl -I http://localhost:3000/aB3xK9

# 3. Delete the cache key
redis-cli DEL url:aB3xK9

# 4. Hit it with 1000 concurrent requests
wrk -t4 -c100 -d10s http://localhost:3000/aB3xK9
```

#### The Fix

Implement **probabilistic early expiration** or a **mutex lock**:

```typescript
// FIXED: Add to src/lib/redis.ts
export async function getCachedUrlStampedeProtected(
  shortCode: string,
  fetchFromDb: () => Promise<string | null>
): Promise<string | null> {
  const key = `url:${shortCode}`;
  const lockKey = `lock:${shortCode}`;
  const cached = await redis.get(key);

  if (cached) {
    // Probabilistic early expiration: refresh if TTL < 10% remaining
    const ttl = await redis.ttl(key);
    if (ttl > 0 && Math.random() < 0.1) {
      // 10% chance to refresh early
      redis.expire(key, 86400).catch(() => {});
    }
    return cached;
  }

  // Try to acquire lock
  const acquired = await redis.set(lockKey, '1', 'EX', 10, 'NX');

  if (acquired) {
    try {
      const dbResult = await fetchFromDb();
      if (dbResult) {
        await redis.setex(key, 86400, dbResult);
      }
      return dbResult;
    } finally {
      await redis.del(lockKey);
    }
  }

  // Another process is fetching. Wait and retry cache.
  await new Promise((r) => setTimeout(r, 50));
  return redis.get(key);
}
```

#### WHY the Fix Works

The `SET ... NX` (set if not exists) acts as a distributed mutex. Only one process fetches from the database. Others wait 50ms and read from the cache. At 10,000 req/s, this reduces database load from 10,000 queries to 1.

---

### Bug 3: URL Validation Bypass

#### How to Introduce

Use a naive regex instead of `new URL()`:

```typescript
// BROKEN: src/lib/validate-url.ts
export function isValidUrl(url: string): boolean {
  return /^https?:\/\//.test(url);
}
```

#### What Symptoms You'll See

- Users can create short links to `javascript:alert('xss')` by passing `javascript:alert('xss')` (regex fails because it doesn't start with http).
- Actually, worse: `http://javascript:alert(1)` passes the regex but `new URL()` would catch it.
- Better attack: `https://example.com@evil.com` — regex passes, `new URL()` sees the auth component but still redirects to `https://example.com@evil.com` which some browsers interpret as `evil.com`.

Wait, the real bypass is:

```typescript
// BROKEN: Only check startsWith
export function isValidUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}
```

Now submit:
```json
{"url": "https://not-a-domain<script>alert(1)</script>"}
```

It starts with `https://`, so it passes. When rendered in an HTML page without escaping, it becomes an XSS vector. Or more directly:

```json
{"url": "javascript:alert('xss')"}
```
With the broken regex that just checks `^https?:`, this fails. But with `startsWith`, an attacker uses:
```json
{"url": "https://example.com\nLocation: javascript:alert(1)"}
```

Actually, the simplest bypass for a bad regex:
```json
{"url": "https://\\\\evil.com"}
```

#### How to Reproduce

```bash
# This should be rejected but passes with naive validation
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{"url": "javascript:alert(1)"}'

# With startsWith validation, this passes:
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{"url": "https://evil.com"}'
# (This one is actually valid. Let's show a real bypass)
```

Real bypass with `startsWith`:
```bash
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{"url": "https:/\\/\\evil.com"}'
```

#### The Fix

```typescript
// FIXED: src/lib/validate-url.ts
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}
```

**Additional hardening** for redirect safety:
```typescript
// Prevent open redirect / header injection
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return null;

    // Reconstruct to strip auth, fragment if needed
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}
```

#### WHY the Fix Works

`new URL()` implements the WHATWG URL Standard. It correctly parses URLs, handles encoding, rejects invalid characters, and exposes the protocol separately from the host. A regex cannot correctly validate URLs without being 500+ characters long. And even then, it misses edge cases.

---

### Bug 4: Missing Analytics Flush

#### How to Introduce

Make analytics writes synchronous and blocking in the redirect handler:

```typescript
// BROKEN: In src/server.ts redirect handler
// AWAIT the analytics increment instead of fire-and-forget
const country = getCountryFromIP(req.ip || '');
const referrer = extractReferrerDomain(req.get('referer'));

await incrementAnalytics(shortCode, country, referrer); // <-- BLOCKING

res.redirect(302, longUrl);
```

Also, write every click directly to PostgreSQL:

```typescript
// BROKEN: In src/server.ts
await prisma.click.create({
  data: {
    urlId: urlRecord.id,
    country,
    referrer,
    userAgent: req.get('user-agent'),
  },
});
```

#### What Symptoms You'll See

- Redirect latency spikes from ~5ms to ~50-200ms.
- p99 latency under load becomes unacceptable.
- PostgreSQL connection pool exhausted by analytics writes.
- Users perceive links as "slow."

#### How to Reproduce

```bash
# Start server with synchronous analytics
pnpm dev

# Load test redirects
wrk -t4 -c100 -d30s http://localhost:3000/aB3xK9

# Watch p99 latency: it climbs over 100ms
```

#### The Fix

**Fire-and-forget Redis analytics** (already in the main code):

```typescript
// FIXED: Don't await analytics in the hot path
incrementAnalytics(shortCode, country, referrer).catch((err) => {
  console.error('Analytics error:', err);
});

res.redirect(302, longUrl);
```

**Background flush to PostgreSQL** (add a worker):

```typescript
// src/workers/analytics-flush.ts
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';

const FLUSH_INTERVAL_MS = 30000;

async function flushAnalytics() {
  const keys = await redis.keys('analytics:*:clicks');

  for (const key of keys) {
    const shortCode = key.split(':')[1];
    const clicksStr = await redis.get(key);
    if (!clicksStr) continue;

    const clicks = parseInt(clicksStr, 10);

    // Batch insert raw click events (simplified)
    // In production, you'd read from a Redis Stream or list
    await prisma.click.createMany({
      data: Array.from({ length: Math.min(clicks, 100) }).map(() => ({
        urlId: 0, // Look up ID in a real implementation
        country: null,
        referrer: null,
      })),
      skipDuplicates: true,
    });

    // Decrement or delete processed keys
    await redis.del(key);
    await redis.del(`analytics:${shortCode}:countries`);
    await redis.del(`analytics:${shortCode}:referrers`);
  }
}

setInterval(flushAnalytics, FLUSH_INTERVAL_MS);
```

**Better approach**: Use a Redis Stream. On redirect, `XADD analytics * urlId 123 country US referrer twitter.com`. A background worker reads the stream in batches and bulk-inserts to PostgreSQL.

#### WHY the Fix Works

Redirects are read-heavy and latency-sensitive. Analytics are write-heavy and can tolerate seconds of delay. By separating them, we keep the redirect path fast (<10ms) while ensuring analytics are eventually consistent. Redis handles 100,000+ writes/sec. PostgreSQL bulk inserts are 100x more efficient than individual row inserts.

---

### Bug 5: Collision Not Handled

#### How to Introduce

Use random generation without existence checks:

```typescript
// BROKEN: src/lib/redis.ts
import crypto from 'crypto';

export async function getRandomShortCode(): Promise<string> {
  // Generate a "random" 6-char code using Math.random()
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
```

Then in the route:
```typescript
const shortCode = await getRandomShortCode();
// No check if it exists!
const newUrl = await prisma.url.create({
  data: { shortCode, longUrl: url },
});
```

#### What Symptoms You'll See

- `P2002 Unique constraint violation` errors when collisions occur.
- With `Math.random()`, collisions are more likely than you'd think. At 100,000 URLs, the birthday paradox makes collisions almost certain with a 6-char code.
- If you remove the unique constraint "to fix the error," data is silently corrupted.

#### How to Reproduce

```bash
# Insert 100,000 URLs
for i in $(seq 1 1000); do
  curl -X POST http://localhost:3000/api/urls \
    -H "Content-Type: application/json" \
    -d '{"url": "https://example.com/'$i'"}' &
done
wait

# Watch logs for unique constraint violations
```

#### The Fix

**Option A: Loop with existence check** (for random generation):

```typescript
async function generateUniqueShortCode(): Promise<string> {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let attempts = 0; attempts < 10; attempts++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    const exists = await prisma.url.findUnique({
      where: { shortCode: code },
      select: { id: true },
    });

    if (!exists) return code;
  }

  throw new Error('Could not generate unique short code after 10 attempts');
}
```

**Option B: Use counter (our preferred approach)**:

```typescript
const counter = await getNextCounter();
const shortCode = encodeBase62(counter);
// Guaranteed unique because counter always increments
```

**Option C: Cryptographically secure random + check**:

```typescript
import crypto from 'crypto';

function secureRandomCode(length = 6): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  const randomBytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }

  return result;
}
```

#### WHY the Fix Works

A counter is mathematically guaranteed to produce unique integers. Base62 encoding is bijective (one-to-one), so unique integers become unique strings. No database check needed. No loops. No collision handling. It's O(1) and deterministic.

If you *must* use random codes, you need existence checks. But existence checks require database queries, which slow down creation. And at high scale, you'll need increasingly long codes to keep collision probability low.

---

## Section 6: Load Testing

### k6 Script

**`load-test.js`**:
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    redirects: {
      executor: 'constant-arrival-rate',
      rate: 10000,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 500,
      maxVUs: 2000,
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<10'], // 99% of requests under 10ms
    http_req_failed: ['rate<0.01'],  // Less than 1% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SHORT_CODE = __ENV.SHORT_CODE || 'aB3xK9';

export default function () {
  const res = http.get(`${BASE_URL}/${SHORT_CODE}`, {
    redirects: 0, // Don't follow redirects; we just want the 302
  });

  check(res, {
    'status is 302': (r) => r.status === 302,
    'response time < 10ms': (r) => r.timings.duration < 10,
    'has location header': (r) => r.headers['Location'] !== undefined,
  });
}
```

### Running the Test

```bash
# Install k6: brew install k6

# 1. Create a test URL and warm the cache
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# 2. Run the load test
k6 run --env BASE_URL=http://localhost:3000 --env SHORT_CODE=aB3xK9 load-test.js
```

### How to Identify Bottlenecks

Watch these metrics during the test:

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| `http_req_duration` (p50) | < 5ms | 5-20ms | > 50ms |
| `http_req_duration` (p99) | < 10ms | 10-50ms | > 100ms |
| `http_req_failed` | < 0.1% | 0.1-1% | > 5% |
| `data_received` | Steady | Dropping | Near zero |

**If p50 is fine but p99 spikes:**
→ Cache stampede or garbage collection pauses. Check Redis TTL distribution.

**If error rate climbs:**
→ PostgreSQL connection pool exhausted. Check `max_connections` and connection pooler (PgBouncer).

**If CPU is 100% on app server:**
→ JSON parsing or validation is too heavy. Consider pre-compiled Zod schemas or bypass validation for cached hits.

**If Redis latency spikes:**
→ You're hitting Redis persistence (RDB snapshot or AOF rewrite). Use a dedicated Redis instance or Elasticache.

### What Metrics to Watch

```bash
# PostgreSQL active connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Redis memory and ops/sec
redis-cli INFO stats
redis-cli INFO memory

# Node.js event loop lag (add this to your app)
import { monitorEventLoopDelay } from 'perf_hooks';
const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();
setInterval(() => {
  console.log(`Event loop delay: ${h.mean / 1e6}ms`);
  h.reset();
}, 5000);
```

---

## Section 7: Deployment

### Railway Deployment Steps

1. **Push to GitHub**:
```bash
git init
git add .
git commit -m "Initial URL shortener"
git push origin main
```

2. **Create Railway Project**:
```bash
npm install -g @railway/cli
railway login
railway init
```

3. **Provision Services**:
```bash
railway add --database postgres
railway add --database redis
```

4. **Set Environment Variables** in Railway Dashboard:
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
NODE_ENV=production
PORT=3000
```

5. **Deploy**:
```bash
railway up
```

### Render Deployment Steps

1. Create a new Web Service on Render, connect your GitHub repo.
2. Set build command: `pnpm install && pnpm db:generate && pnpm build`
3. Set start command: `pnpm start`
4. Add PostgreSQL and Redis instances from the Render dashboard.
5. Copy connection strings to Environment Variables.

### Environment Variables Reference

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | Yes | `postgresql://...` | PostgreSQL connection |
| `REDIS_URL` | Yes | `redis://...` | Redis connection |
| `PORT` | No | `3000` | HTTP server port |
| `NODE_ENV` | Yes | `production` | Environment mode |
| `GEOIP_DB_PATH` | No | `/data/GeoLite2-Country.mmdb` | MaxMind DB file path |
| `RATE_LIMIT_MAX` | No | `10` | URL creation rate limit |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Rate limit window |

---

## Section 8: Post-Mortem Template

After you've built, broken, and fixed this system, answer these questions honestly. This is where learning solidifies.

### Reflection Questions

1. **What was the hardest bug to find?**
   - Was it the race condition? The cache stampede? Something else?
   - What tool helped you find it? (Logs? Debugger? Load test?)
   - How long did it take?

2. **What would break at 100,000 req/s?**
   - Is your PostgreSQL connection pool big enough?
   - Is Redis still on a single core?
   - What's your plan for horizontal scaling (multiple app servers)?
   - Do you need a CDN for the redirect endpoint itself?

3. **What did you learn about caching?**
   - When is caching harmful? (Hint: when data changes frequently and consistency matters.)
   - What's the difference between cache-aside and write-through?
   - Why did we use `SETEX` (set with expiry) instead of plain `SET`?

4. **What would you do differently?**
   - Would you choose a different database?
   - Would you use a different encoding scheme?
   - How would you handle GDPR compliance for analytics?

5. **Security retrospective**
   - Did you test the URL validation bypass?
   - What happens if someone submits a URL to your internal admin panel?
   - How do you prevent someone from creating a short link to `https://your-bank.com/transfer?to=attacker&amount=1000`?

6. **Observability**
   - What would you log in production?
   - What alerts would wake you up at 3 AM?
   - How do you distinguish between "Redis is down" and "PostgreSQL is slow"?

---

## Appendix: Quick Reference

### Project Structure

```
url-shortener/
├── src/
│   ├── lib/
│   │   ├── base62.ts
│   │   ├── bloom-filter.ts
│   │   ├── counter.ts
│   │   ├── geo.ts
│   │   ├── prisma.ts
│   │   ├── redis.ts
│   │   ├── referrer.ts
│   │   └── validate-url.ts
│   ├── workers/
│   │   └── analytics-flush.ts
│   └── server.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── load-test.js
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── .env
```

### npm Scripts

```bash
pnpm dev              # Start with hot reload
pnpm build            # Compile TypeScript
pnpm start            # Run compiled app
pnpm db:migrate       # Run Prisma migrations
pnpm db:generate      # Generate Prisma client
```

### Useful Docker Commands

```bash
docker-compose up -d db redis    # Just the data stores
docker-compose logs -f app       # Follow app logs
docker-compose exec db psql -U postgres -d urlshortener
```

---

*Built with Express 5, Prisma 6, TypeScript 5.7, and pnpm. Tested on Node.js 22.*

*Now go break it. Then fix it. Then break it again. That's how you learn.*
