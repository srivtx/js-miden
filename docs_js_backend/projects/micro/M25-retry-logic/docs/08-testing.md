# Testing: Retry Logic

## Test Strategy

### Unit Tests

Test retry client in isolation:

```typescript
describe('RetryClient', () => {
  it('succeeds on first try', async () => {
    const client = new RetryClient();
    const result = await client.fetch('http://localhost/success');
    expect(result.status).toBe(200);
  });

  it('retries on 5xx', async () => {
    let attempts = 0;
    const client = new RetryClient();

    // Mock server that fails first 2 times
    const result = await client.fetch('http://localhost/fail-twice');
    expect(attempts).toBe(3);
  });

  it('does not retry on 4xx', async () => {
    let attempts = 0;
    const client = new RetryClient();

    try {
      await client.fetch('http://localhost/404');
    } catch {}

    expect(attempts).toBe(1);
  });
});
```

### Backoff Tests

```typescript
it('uses exponential backoff', async () => {
  const delays: number[] = [];
  const client = new RetryClient({
    maxRetries: 3,
    baseDelayMs: 100,
  });

  // Mock sleep to capture delays
  for (let i = 0; i < 3; i++) {
    const delay = client.calculateDelay(i);
    delays.push(delay);
  }

  expect(delays[0]).toBeGreaterThanOrEqual(100);
  expect(delays[1]).toBeGreaterThanOrEqual(200);
  expect(delays[2]).toBeGreaterThanOrEqual(400);
});
```

### Jitter Tests

```typescript
it('has jitter variance', async () => {
  const durations: number[] = [];

  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    try {
      await client.fetch('http://localhost/always-fails');
    } catch {}
    durations.push(Date.now() - start);
  }

  const variance = Math.max(...durations) - Math.min(...durations);
  expect(variance).toBeGreaterThan(50); // Should vary
});
```

### Integration Tests

```typescript
it('GET /fetch retries and succeeds', async () => {
  const res = await request(app).get('/fetch?url=http://localhost/success');
  expect(res.status).toBe(200);
});

it('GET /fetch returns 502 after exhausted retries', async () => {
  const res = await request(app).get('/fetch?url=http://localhost/always-500');
  expect(res.status).toBe(502);
});
```

## Test Checklist

- [ ] Succeeds on first try
- [ ] Retries on 5xx
- [ ] Does not retry on 4xx
- [ ] Exponential backoff
- [ ] Has jitter
- [ ] Times out slow requests
- [ ] Respects max retries
- [ ] Returns error after exhaustion
- [ ] Total duration is bounded
