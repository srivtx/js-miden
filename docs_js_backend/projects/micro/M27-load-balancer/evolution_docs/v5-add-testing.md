# v5: Add Testing — Load Balancer

## The Pain

You refactor `selectBackend()` to use a random selection algorithm for "better distribution." It compiles. You deploy. Now the same client gets routed to a different backend on every request, breaking session affinity. Your auth cookies are invalid 66% of the time.

You find out when login success rate drops to 33%.

## The Solution

Jest + controlled backend simulation. Test round-robin, health filtering, and failure recovery.

## The Test File

```typescript
// tests/balancer.test.ts
import request from 'supertest';
import { app } from '../src/index.js';
import { selectBackend, setBackendHealth, getBackends } from '../src/balancer.js';

describe('Load Balancer', () => {
  beforeEach(() => {
    getBackends().forEach(b => setBackendHealth(b.port, true));
  });

  it('should distribute round-robin', () => {
    const ports: number[] = [];
    for (let i = 0; i < 6; i++) {
      const backend = selectBackend();
      ports.push(backend!.port);
    }
    expect(ports).toEqual([3001, 3002, 3003, 3001, 3002, 3003]);
  });

  it('should skip unhealthy backends', () => {
    setBackendHealth(3002, false);
    const ports: number[] = [];
    for (let i = 0; i < 4; i++) {
      const backend = selectBackend();
      ports.push(backend!.port);
    }
    expect(ports).not.toContain(3002);
  });

  it('should return 503 when all backends are down', () => {
    getBackends().forEach(b => setBackendHealth(b.port, false));
    const backend = selectBackend();
    expect(backend).toBeNull();
  });

  it('should restore backend when health returns', () => {
    setBackendHealth(3002, false);
    expect(selectBackend()!.port).not.toBe(3002);

    setBackendHealth(3002, true);
    let found = false;
    for (let i = 0; i < 10; i++) {
      if (selectBackend()!.port === 3002) found = true;
    }
    expect(found).toBe(true);
  });
});
```

## The Bug It Catches

The `should skip unhealthy backends` test catches the missing health filter:

```typescript
// BEFORE: No health filtering
export function selectBackend(): Backend | null {
  if (backends.length === 0) return null;
  const backend = backends[counter % backends.length];
  counter++;
  return backend; // May return dead backend
}
```

The test marks port 3002 as unhealthy, then makes 4 selections. If health is not filtered, 3002 appears in the results and the test fails.

## Why Tests Catch Breakage Before Deploy

- **Health awareness**: Tests guarantee dead backends are skipped
- **Distribution**: Tests verify round-robin is deterministic
- **Recovery**: Tests confirm restored backends re-enter rotation
- **All-down safety**: Tests validate 503 when no backends are healthy

Without tests, a "performance optimization" that caches backend selection and ignores health updates will pass review and route traffic to dead servers.
