# 03-CONCEPTS.md — Rate Limiter (M05)

## 1. Rate Limiting Algorithms (Deep Dive)

### WHAT

Algorithms enforce a maximum number of requests `R` within a time window `W`.

### Fixed Window Counter

**HOW:**
Divide time into discrete buckets of size `W`. Each bucket has a counter.

```
Bucket for 01:00-01:59 → count = 0
Request at 01:15 → count = 1
...
Request at 01:58 → count = 10
Request at 01:59 → BLOCKED

Bucket for 02:00-02:59 → count = 0 (RESET!)
Request at 02:00 → count = 1 (ALLOWED)
```

**Mathematically:**
- Window key: `k = floor(t / W)` where `t` is current timestamp.
- Allowed if `count[k] < R`.
- Else: block with `Retry-After = (k + 1) * W - t`.

**WHY it fails:**
At the boundary between `k` and `k+1`, an attacker can send `R` requests in the last microsecond of `k` and `R` requests in the first microsecond of `k+1`. Total: `2R` in `2ε` time.

For `R = 10, W = 60s`: **20 requests in 1 second** is possible.

---

### Sliding Window Log

**HOW:**
Store the exact timestamp of every request. Before allowing a new request, remove all timestamps older than `t - W`, then count the remainder.

**Mathematically:**
- Let `S` be the set of request timestamps for a client.
- Remove all `s ∈ S` where `s < t - W`.
- Allowed if `|S| < R`.
- If allowed, insert `t` into `S`.

**WHY it is accurate:**
It enforces a true rolling window. A request at `02:00:00` sees the 10 requests from `01:59:00-01:59:59` and blocks correctly.

**Trade-off:**
Stores one entry per request. For high-traffic APIs, memory usage scales with `R`.

---

### Sliding Window Counter (Approximate)

**HOW:**
Combine the current fixed-window count with a weighted fraction of the previous window's count.

```
weight = (W - elapsed_in_current_window) / W
estimated_count = current_count + (previous_count * weight)
```

**WHY it is used:**
Redis stores only two counters (current + previous) instead of every timestamp. Good enough for most APIs.

**Trade-off:**
Approximate. Can allow slightly more or fewer than `R` requests.

---

### Token Bucket

**HOW:**
- Bucket holds at most `B` tokens.
- Tokens refill at rate `r = R / W` tokens per second.
- Each request consumes 1 token.
- If no tokens remain, block.

**Mathematically:**
- Let `tokens` be current token count.
- Let `last_check` be timestamp of last update.
- On request:
  ```
  delta = t - last_check
  tokens = min(B, tokens + delta * r)
  if tokens >= 1:
      tokens -= 1
      ALLOW
  else:
      BLOCK
  ```

**WHY it is different:**
Allows bursts up to `B` immediately, then throttles to steady-state rate `r`. Great for APIs where a user might open an app and need 20 requests instantly, then 1 per second after.

---

## 2. Redis Sorted Sets for Sliding Window

### WHAT

A Redis **Sorted Set** (`ZSET`) is a collection of unique members, each with a numeric score. Members are stored sorted by score. For a sliding window:
- **Member:** request ID or random string.
- **Score:** request timestamp (milliseconds since epoch).

### HOW: The Three Commands

#### `ZADD key score member`

Add the current request to the set.

```redis
ZADD ratelimit:192.168.1.1 1715001600000 req_abc123
```

Returns `1` if added, `0` if member already existed.

#### `ZREMRANGEBYSCORE key min max`

Remove all entries with a score (timestamp) older than `now - W`.

```redis
ZREMRANGEBYSCORE ratelimit:192.168.1.1 0 1715001540000
```

This deletes everything before the 60-second window.

#### `ZCARD key`

Count how many entries remain in the set. This is the number of requests in the current sliding window.

```redis
ZCARD ratelimit:192.168.1.1
```

If `ZCARD >= 10`, block the request.

### EXAMPLE: Full Lua Script (Atomic)

```lua
local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local member = ARGV[4]

-- Remove old entries
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Count current entries
local count = redis.call('ZCARD', key)

if count < limit then
    -- Allow: add this request
    redis.call('ZADD', key, now, member)
    redis.call('PEXPIRE', key, window)
    return {1, limit - count - 1}
else
    -- Block
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retry_after = math.ceil((oldest[2] + window - now) / 1000)
    return {0, retry_after}
end
```

**WHY Lua?**
Redis executes Lua scripts atomically (no other commands interleave). This prevents the race condition where two simultaneous requests both read `count = 9` and both proceed.

## 3. Retry-After Header

### WHAT

An HTTP response header telling the client when to retry.

### WHY

- Improves client experience (no guesswork).
- Reduces thundering herd (clients don't all retry at exactly the same time if combined with jitter).
- Required by RFC 6585 for 429 responses.

### HOW

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 47
Content-Type: application/json

{ "error": "Too Many Requests" }
```

`Retry-After` can be:
- **Seconds** (integer): Wait this many seconds.
- **HTTP-Date**: `Retry-After: Wed, 06 May 2026 14:00:00 GMT`.

For sliding window, compute:
```typescript
const retryAfterSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
```

### WRONG vs RIGHT

| WRONG | RIGHT |
|-------|-------|
| Omit `Retry-After` on 429 | Always include it |
| Send `Retry-After: 0` when blocked | Compute the actual time until the oldest request ages out |
| Use absolute dates without timezone | Prefer integer seconds; if using dates, use GMT |
| Only send headers on 429 | Send `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` on 200 too |

## SOURCES

- [RFC 6585 — Additional HTTP Status Codes](https://datatracker.ietf.org/doc/html/rfc6585)
- [IETF Draft — RateLimit Headers](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers)
- Redis docs, "Sorted Sets" and "Eval" (Lua scripting).
- "Rate Limiting: A Practical Guide" by Brandur Leach, 2021.
