# HOW: Bulkhead Pattern

## How the Bulkhead Works

### 1. Pool Creation

Two pools are created with fixed capacities:

```typescript
const poolA = new Pool('critical', 3);   // user-facing requests
const poolB = new Pool('background', 3); // background jobs
```

### 2. Request Assignment

Requests are tagged with a pool name. The bulkhead checks if that pool has capacity:

```typescript
if (poolA.hasCapacity()) {
  poolA.acquire();
  await handleRequest(req);
  poolA.release();
} else {
  res.status(503).send('Pool full');
}
```

### 3. Capacity Tracking

Each pool tracks:
- `max`: maximum concurrent operations
- `active`: currently running operations

### 4. Isolation Guarantee

Pool B being at capacity (`active === max`) must not affect Pool A's ability to acquire slots.

## File Breakdown

| File | Purpose |
|------|---------|
| `src/index.ts` | Express app, routes for critical and background endpoints |
| `src/bulkhead.ts` | Bulkhead logic: assigns requests to pools, handles rejection |
| `src/pool.ts` | Pool class with acquire/release/capacity tracking |

## Running the Bulkhead Server

```bash
npm run dev

# Critical requests (Pool A)
curl http://localhost:3000/critical

# Background jobs (Pool B)
curl http://localhost:3000/background
```

## Testing Isolation

Send 4 concurrent background requests (Pool B max = 3), then send a critical request. The critical request should succeed because Pool A is separate.
