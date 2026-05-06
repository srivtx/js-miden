# v5: Add Testing — Service Discovery

## The Pain

You refactor `getServices()` to use a Map instead of an array for O(1) lookups. It compiles. You deploy. Now `cleanup()` iterates the array with `splice()`, but the data structure is a Map — `splice` doesn't exist on Map. The cleanup job crashes every 1.5 seconds, filling your logs with `TypeError: registry.splice is not a function`.

You find out when your log bill exceeds your compute bill.

## The Solution

Jest + time manipulation. Test registration, heartbeat, TTL expiry, and cleanup.

## The Test File

```typescript
// tests/registry.test.ts
import request from 'supertest';
import { app } from '../src/index.js';
import { getRegistry, cleanup } from '../src/registry.js';

describe('Service Discovery', () => {
  beforeEach(() => {
    getRegistry().splice(0, getRegistry().length); // clear registry
  });

  it('should register a service', async () => {
    const res = await request(app)
      .post('/register')
      .send({ name: 'user-service', url: 'http://localhost:3001' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('user-service');
    expect(res.body.id).toBeDefined();
  });

  it('should discover registered services', async () => {
    const reg = await request(app)
      .post('/register')
      .send({ name: 'user-service', url: 'http://localhost:3001' });

    await request(app)
      .post(`/heartbeat/${reg.body.id}`);

    const res = await request(app).get('/discover/user-service');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('should remove stale services after TTL', async () => {
    const reg = await request(app)
      .post('/register')
      .send({ name: 'user-service', url: 'http://localhost:3001' });

    // Wait for TTL to expire
    await new Promise(r => setTimeout(r, 3500));
    cleanup();

    const res = await request(app).get('/discover/user-service');
    expect(res.body).toHaveLength(0);
  });

  it('should keep services alive with heartbeats', async () => {
    const reg = await request(app)
      .post('/register')
      .send({ name: 'user-service', url: 'http://localhost:3001' });

    // Heartbeat every 1s to stay alive
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 500));
      await request(app).post(`/heartbeat/${reg.body.id}`);
    }

    cleanup();
    const res = await request(app).get('/discover/user-service');
    expect(res.body).toHaveLength(1);
  });

  it('should return 404 for unknown heartbeat', async () => {
    const res = await request(app).post('/heartbeat/nonexistent-id');
    expect(res.status).toBe(404);
  });
});
```

## The Bug It Catches

The `should remove stale services after TTL` test catches the missing cleanup:

```typescript
// BEFORE: No cleanup
export function getServices(name: string): Service[] {
  return registry.filter(s => s.name === name); // Returns dead services too
}
```

The test registers a service, waits 3.5 seconds (longer than the 3s TTL), calls `cleanup()`, and asserts no services are returned. Without cleanup or TTL filtering, the service is still there and the test fails.

## Why Tests Catch Breakage Before Deploy

- **TTL enforcement**: Tests verify dead services disappear
- **Heartbeat efficacy**: Tests confirm heartbeats extend lifetime
- **Cleanup correctness**: Tests validate `splice` index math
- **Error handling**: Tests ensure unknown IDs get 404, not crash

Without tests, a refactor that replaces the array with a Map but forgets to update `cleanup()` will crash in production every 1.5 seconds.
