# 06-BUGS.md — Rate Limiter (M05)

## The Bug: Fixed Window Allows Burst at Boundaries

### WHAT

The implementation uses a **fixed-window counter** (`INCR` + `PEXPIRE`) instead of a true sliding window. This allows an attacker to send **2x the allowed rate** by straddling a window boundary.

### WHY IT HAPPENS

A fixed window divides time into discrete buckets. The counter resets to `0` at the start of each new bucket. The attacker exploits the reset.

### TIMELINE DIAGRAM

```
Time →

Window 1 (01:59:00 - 01:59:59.999)          Window 2 (02:00:00 - 02:00:59.999)
├─────────────────────────────────────────┤  ├─────────────────────────────────────────┤
│                                         │  │                                         │
│ 01:59:55  req 1  ──► count = 1          │  │ 02:00:00  req 11 ──► count = 1  ◄──┐  │
│ 01:59:56  req 2  ──► count = 2          │  │ 02:00:01  req 12 ──► count = 2      │  │
│ 01:59:56  req 3  ──► count = 3          │  │ 02:00:01  req 13 ──► count = 3      │  │
│ 01:59:57  req 4  ──► count = 4          │  │ 02:00:02  req 14 ──► count = 4      │  │
│ 01:59:57  req 5  ──► count = 5          │  │ 02:00:02  req 15 ──► count = 5      │  │
│ 01:59:58  req 6  ──► count = 6          │  │ 02:00:03  req 16 ──► count = 6      │  │
│ 01:59:58  req 7  ──► count = 7          │  │ 02:00:03  req 17 ──► count = 7      │  │
│ 01:59:59  req 8  ──► count = 8          │  │ 02:00:04  req 18 ──► count = 8      │  │
│ 01:59:59  req 9  ──► count = 9          │  │ 02:00:04  req 19 ──► count = 9      │  │
│ 01:59:59  req 10 ──► count = 10  ✓      │  │ 02:00:05  req 20 ──► count = 10 ✓  │  │
│                                         │  │                                         │
│ 01:59:59.500                         │  │                                         │
│     │                                   │  │                                         │
│     ▼                                   │  │                                         │
│  KEY: ratelimit:1.2.3.4:<window1>       │  │  KEY: ratelimit:1.2.3.4:<window2>      │
│  TTL: 60000 ms                          │  │  TTL: 60000 ms                          │
│                                         │  │                                         │
└─────────────────────────────────────────┘  └─────────────────────────────────────────┘

                     ▲
                     │
              BOUNDARY CROSSING
              (counter resets!)

RESULT: 20 requests allowed in ~10 seconds
INTENT: 10 requests per 60 seconds
```

### THE ATTACK IN NUMBERS

| Metric | Intended | Actual (Bug) |
|--------|----------|--------------|
| Window | 60 seconds | 60 seconds (discrete buckets) |
| Max requests | 10 | 10 per bucket |
| Burst at boundary | 10 / 60s | **20 / ~10s** |
| Fairness | Uniform | Skewed toward boundary times |

### HOW TO REPRODUCE

Run the boundary test:

```bash
# Terminal 1
docker compose up -d
npm run dev

# Terminal 2
node boundary-test.js
```

Expected output:
```
=== Boundary Burst Test ===
Current time: 2026-05-06T12:34:56.789Z
Next window boundary: 2026-05-06T12:35:00.000Z
Waiting 3211ms for boundary...

  Sending 10 requests (before boundary)...
    Success: 10, Blocked: 0
  Waiting 321ms to cross boundary...
  Sending 10 requests (after boundary)...
    Success: 10, Blocked: 0

=== RESULTS ===
Total requests: 20
Allowed through: 20
Expected (true sliding window): ~10
Bug present: YES - Fixed window allows burst attack!
```

### THE FIX: True Sliding Window

Replace the fixed-window `INCR` with a Redis sorted set (sliding window log):

1. `ZADD ratelimit:<ip> <timestamp> <requestId>` — record this request.
2. `ZREMRANGEBYSCORE ratelimit:<ip> 0 <timestamp - 60000>` — evict old requests.
3. `ZCARD ratelimit:<ip>` — count requests in the last 60 seconds.
4. If `ZCARD >= 10`, block. Otherwise, allow.
5. Wrap all four steps in a **Lua script** for atomicity.

With this fix, at `02:00:00` the sorted set still contains the 10 requests from `01:59:00-01:59:59`. The 11th request at `02:00:00` is correctly blocked.

### WRONG vs RIGHT

| WRONG (Current) | RIGHT (Fixed) |
|-----------------|---------------|
| `INCR` on a time-bucket key | `ZADD` + `ZREMRANGEBYSCORE` + `ZCARD` in Lua |
| Counter resets at boundary | Counter reflects rolling 60-second window |
| No request history | Full timestamp history (scalable for R=10) |
| `PEXPIRE` on bucket key | `PEXPIRE` on sorted set (optional cleanup) |
| Allows 20 req in ~10s | Enforces max 10 req in any 60s interval |

### SOURCES

- Stripe Engineering, "Rate Limiters," 2017.
- Cloudflare, "How We Built Rate Limiting," 2022.
- Redis docs, "Sorted Sets" and "Lua scripting."
