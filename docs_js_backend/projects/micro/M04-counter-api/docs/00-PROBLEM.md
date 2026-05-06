# M04: Problem Definition — Counter API (Redis)

## WHAT

Build a simple counter API with two HTTP endpoints:

- `POST /increment` — Atomically increments a counter by 1 and returns the new value
- `GET /count` — Returns the current counter value

Both endpoints must return JSON:

```json
{ "count": 42 }
```

The counter must be **persistent** (survives server restarts) and **consistent under concurrent load** (1000 simultaneous requests must result in count = 1000).

## WHY This Exists

### The Counting Problem Is Everywhere

Counters are not toy examples. They are foundational infrastructure:

- **Rate limiting:** "How many requests has this API key made in the last minute?"
- **Analytics:** "How many page views today?"
- **Inventory:** "How many tickets remaining?"
- **Leaderboards:** "What is the user's current score?"
- **Job queues:** "How many jobs processed?"

In every case, the same core requirement applies: **increment must be accurate under concurrency.**

### Why This Is Harder Than It Looks

The naive implementation looks correct:

```typescript
const current = await redis.get('counter');
const value = parseInt(current || '0', 10) + 1;
await redis.set('counter', value.toString());
return value;
```

It reads, increments, and writes. Sequential. Logical. **And completely broken under concurrency.**

This project exists to teach why the obvious solution fails and why the correct solution (atomic operations) is necessary.

## Constraints

| Constraint | Rationale |
|------------|-----------|
| Must use Redis | Redis provides single-threaded atomic commands (`INCR`) that eliminate race conditions. File systems and in-memory stores do not. |
| Must be atomic | Under 1000 concurrent requests, the final count must equal 1000. No lost increments. |
| Must persist | Counter survives server restart. In-memory counters reset to 0 on restart. |
| Must fail fast if Redis is down | Return `503` within milliseconds, not hang forever. |
| Must use TypeScript + ESM | Modern Node.js standards. |

## Anti-Requirements (What We Deliberately Do NOT Do)

| Anti-Requirement | Why We Skip It |
|------------------|----------------|
| **No multi-key transactions** | We only increment one key. Redis `MULTI`/`EXEC` is overkill. |
| **No historical data** | We do not store "who incremented" or "when." That requires a different data model (streams, timeseries). |
| **No sharding** | A single Redis instance handles millions of ops/sec. Sharding (Redis Cluster) is unnecessary until you exceed that. |
| **No local cache** | The counter must be real-time. A local cache would return stale values in a multi-instance deployment. |

## The Hidden Danger

The read-modify-write pattern fails silently. It works perfectly in development with single requests. It only fails under concurrent load:

```bash
# In development (sequential):
curl -X POST http://localhost:3000/increment  # returns 1
curl -X POST http://localhost:3000/increment  # returns 2
# Looks correct!

# Under concurrent load:
# 1000 simultaneous requests → final count = ~400 (600 lost!)
# No errors. No crashes. Just silently wrong data.
```

This is the worst kind of bug: **silent data loss.**
