# M05 - Sliding Window Rate Limiter

A rate limiter micro project built with **Express 5**, **TypeScript**, **Redis**, and **ESM**.

## Architecture

```
┌─────────┐     ┌──────────────┐     ┌───────┐
│ Client  │────▶│ Express App  │────▶│ Redis │
└─────────┘     └──────────────┘     └───────┘
                       │
                  Rate Limiter
                (per IP, 10/min)
```

## Quick Start

```bash
# Start Redis
docker compose up -d

# Install dependencies
npm install

# Run server
npm run dev

# Run tests
npm test

# Run boundary burst demonstration
npm run boundary-test
```

## API Endpoints

| Method | Path        | Description                    |
|--------|-------------|--------------------------------|
| GET    | `/health`   | Health check (unlimited)       |
| GET    | `/api/data` | Protected endpoint (10 req/min)|

## Rate Limit Headers

| Header                  | Description                                      |
|-------------------------|--------------------------------------------------|
| `X-RateLimit-Limit`     | Maximum requests allowed (10)                    |
| `X-RateLimit-Remaining` | Requests remaining in current window             |
| `X-RateLimit-Reset`     | Unix timestamp when the window resets            |
| `Retry-After`           | Seconds to wait before retrying (429 responses)  |

## Project Phases

### Phase 1 - Problem
Build a rate limiter that allows max 10 requests per minute per IP. Return **429 Too Many Requests** with `Retry-After` header when exceeded. Must be accurate (no burst at window boundaries).

### Phase 2 - Thinking
- **Fixed window**: Easy but allows 2x burst at boundary (10 at 1:59, 10 at 2:00)
- **Sliding window**: Accurate but more complex
- **Token bucket**: Allows bursts, good for APIs
- **Where to store state?** Memory (single server) vs Redis (distributed)
- **What identifies a client?** IP (can be spoofed/shared) vs User ID vs API Key

### Phase 3 - Decisions
- Sliding window log (store timestamps, count recent ones)
- Redis sorted sets (perfect for sliding window)
- Identify by IP (simplest for this project)
- Return `RateLimit-*` headers for client awareness

### Phase 4 - Code
Complete Express + Redis implementation in `src/`.

### Phase 5 - The Bug
**INTENTIONAL BUG**: The implementation uses a **fixed-window counter** (`INCR` + `EXPIRE`) instead of a true sliding window. This allows a burst attack at window boundaries.

**Attack scenario**: Send 10 requests at 1:59:59 and 10 at 2:00:00 &rarr; **20 requests allowed in 1 second**.

Run `npm run boundary-test` to see it in action.

## The Fix

A true sliding window should use **Redis sorted sets**:

1. `ZADD` the current timestamp to a sorted set keyed by IP
2. `ZREMRANGEBYSCORE` to remove timestamps older than the window
3. `ZCARD` to count how many requests remain in the sliding window
4. Wrap in a Lua script or Redis transaction for atomicity

This ensures that a request at 2:00:00 sees the 10 requests from 1:59:00-1:59:59 and correctly blocks the burst.
