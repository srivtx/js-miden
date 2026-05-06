# HOW: Load Balancer

## How the Load Balancer Works

### 1. Backend Registration

On startup, the balancer is configured with three backends:

```typescript
const backends = [
  { url: 'http://localhost:3001', healthy: true },
  { url: 'http://localhost:3002', healthy: true },
  { url: 'http://localhost:3003', healthy: true },
];
```

### 2. Round-Robin Selection

A counter increments with each request. The backend at `counter % backends.length` is chosen.

```typescript
let index = counter++ % backends.length;
let backend = backends[index];
```

### 3. Health Checks (Intended)

Every 5 seconds, the balancer should send a `GET /health` probe to each backend. If a probe fails, the backend is marked `healthy: false` and skipped during selection. If a probe succeeds after failure, it is restored.

### 4. Request Proxying

The selected backend receives the forwarded request. The response is piped back to the client.

## File Breakdown

| File | Purpose |
|------|---------|
| `src/index.ts` | Express app, routes all requests through the balancer |
| `src/balancer.ts` | Round-robin selection, backend list management |
| `src/health.ts` | Periodic health probe logic |

## Running the Load Balancer

```bash
# Terminal 1-3: Start backends
npm run dev:backend1
npm run dev:backend2
npm run dev:backend3

# Terminal 4: Start balancer
npm run dev

# Send 6 requests
for i in {1..6}; do curl http://localhost:3000/; done
# → requests distributed across S1, S2, S3, S1, S2, S3
```
