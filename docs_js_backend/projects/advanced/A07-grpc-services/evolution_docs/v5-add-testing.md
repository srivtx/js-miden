# A07 Evolution: v5 — Add Testing

## State of the System

The gRPC gateway and services are covered by Vitest. Tests verify REST-to-gRPC translation, proto compatibility, streaming behavior, and the intentional deadline/retry bugs.

## What Changed

- **Unit tests for services.**
  - `user-service.test.ts` — verifies `getUser`, `createUser`, and `listUsers` streaming.
  - `order-service.test.ts` — verifies `createOrder`, `getOrder`, and `listUserOrders` streaming.
- **Integration tests for gateway.**
  - `GET /users/:id` → returns 404 for unknown users, 200 with data for known users.
  - `POST /orders` → returns 201 after verifying user exists via gRPC.
  - `GET /orders?user_id=1` → streams orders via server-streaming translation.
- **Bug reproduction tests.**
  - `deadline.test.ts` — starts the gateway, kills the order service, and asserts that `POST /orders` hangs indefinitely (documenting the no-deadline bug).
  - `retry.test.ts` — restarts the order service mid-request and asserts that the request fails with `UNAVAILABLE` (documenting the no-retry bug).
  - `proto-mismatch.test.ts` — asserts that `total_cents` sent by the gateway becomes `amount_cents: 0` on the server (documenting the proto version mismatch bug).

## What Still Breaks

- **No deadline enforcement.** The test documents the hang but does not assert a timeout. A fix would pass a `deadline` option to every gRPC call.
- **No retry logic.** The test documents the failure on transient `UNAVAILABLE` but does not assert recovery. A fix would configure `grpc.service_config` with exponential backoff.
- **Proto mismatch is documented but not fixed.** The test asserts the bug. A fix would align proto files and use `reserved` for deleted fields.
- **No mTLS tests.** The system uses `grpc.credentials.createInsecure()`. There is no test for certificate validation or mutual authentication.

## Code Snapshot (tests/grpc.test.ts)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startUserService, startOrderService } from '../src/services/index.js';
import { app } from '../src/gateway/index.js';
import request from 'supertest';

describe('gRPC gateway', () => {
  let userServer, orderServer;

  beforeAll(() => {
    userServer = startUserService(50051);
    orderServer = startOrderService(50052);
  });

  afterAll(() => {
    userServer.forceShutdown();
    orderServer.forceShutdown();
  });

  it('creates a user', async () => {
    const res = await request(app).post('/users').send({ email: 'a@b.com', name: 'Alice' });
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('a@b.com');
  });

  it('BUG: proto mismatch causes amount_cents to be 0', async () => {
    await request(app).post('/users').send({ email: 'a@b.com', name: 'Alice' });
    const res = await request(app).post('/orders').send({ user_id: '1', total_cents: 5000, items: [] });
    expect(res.status).toBe(201);
    expect(res.body.data.amount_cents).toBe(0); // Bug: total_cents was ignored
  });
});
```

## Architectural Notes

This is the "error handling + streaming" stage. The test suite verifies that server-streaming RPCs (`ListUsers`, `ListUserOrders`) are correctly translated to HTTP responses. It also documents the three critical bugs: missing deadlines, missing retries, and proto version mismatch. These bugs are realistic production failures that every gRPC engineer encounters.

## Migration Path to v6

1. Switch to ES modules (`"type": "module"` in package.json) and ensure `.proto` files are loadable via `fileURLToPath`.
2. Fix the proto mismatch by using `reserved` and aligning all services to the same proto version.
3. Add deadlines and retry policies to all gRPC calls.
