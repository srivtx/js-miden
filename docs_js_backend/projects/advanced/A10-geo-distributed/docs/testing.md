# Testing Guide

## Test Structure

```
tests/
├── routing.test.ts      # Latency-based routing
├── storage.test.ts      # Local storage with vector clocks
├── replication.test.ts  # Cross-region replication
└── conflict.test.ts     # Conflict resolution (contains bug test)
```

## Running Tests

```bash
npm test
npm run test:watch
```

## Test Categories

### Routing Tests

```typescript
describe('RoutingService', () => {
  it('should route user to lowest latency region', () => {
    routing.reportLatency('us-east', 20);
    routing.reportLatency('us-west', 50);
    expect(routing.routeUser('user-1')).toBe('us-east');
  });
});
```

### Conflict Tests

The conflict resolution bug is documented:

```typescript
it('BUG: Concurrent updates lose data with last-write-wins', () => {
  const local = { value: { balance: 100 }, vectorClock: { 'us-east': 1 } };
  const remote = { value: { balance: 200 }, vectorClock: { 'us-west': 1 } };

  const result = service.resolveConflict(local, remote);

  // BUG: Last-write-wins picks one, losing the other update
  expect(result.winner.value).toEqual({ balance: 200 });
  expect(result.strategy).toBe('last-write-wins');
  expect(result.loser.value).toEqual({ balance: 100 }); // Lost!
});
```

### Replication Tests

- Simulate network partitions
- Test eventual consistency
- Verify vector clock merging

## Chaos Testing

Use `toxiproxy` to simulate network issues:

```bash
docker run -it --rm shopify/toxiproxy
```

## References

[1] Vitest Documentation. https://vitest.dev/
[2] "Chaos Engineering," Principles of Chaos. https://principlesofchaos.org/