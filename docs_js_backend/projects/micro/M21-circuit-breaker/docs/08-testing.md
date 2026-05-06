# Testing: Circuit Breaker

## Test Strategy

### Unit Tests

Test the circuit breaker class in isolation:

```typescript
describe('CircuitBreaker', () => {
  it('starts in closed state', () => {
    const breaker = new CircuitBreaker();
    expect(breaker.getState()).toBe('closed');
  });

  it('opens after threshold failures', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(() => Promise.reject(new Error('fail')));
      } catch {}
    }

    expect(breaker.getState()).toBe('open');
  });

  it('returns 503 when open', async () => {
    // Force open state
    (breaker as any).state = 'open';
    (breaker as any).lastOpenTime = Date.now();

    await expect(
      breaker.execute(() => Promise.resolve('ok'))
    ).rejects.toThrow('OPEN');
  });
});
```

### Integration Tests

Test via HTTP API:

```typescript
it('opens circuit after 5 API failures', async () => {
  await request(app).post('/simulate/fail').send({ fail: true });

  // Trigger 5 failures
  for (let i = 0; i < 5; i++) {
    await request(app).get('/api/external');
  }

  // 6th request should be 503
  const res = await request(app).get('/api/external');
  expect(res.status).toBe(503);
});
```

### State Transition Tests

```typescript
it('transitions to half-open after timeout', async () => {
  const breaker = new CircuitBreaker({
    halfOpenTimeoutMs: 100,
  });

  // Force open
  (breaker as any).state = 'open';
  (breaker as any).lastOpenTime = Date.now();

  // Wait for timeout
  await sleep(150);

  expect(breaker.getState()).toBe('half-open');
});
```

### Timeout Tests

```typescript
it('fails on timeout', async () => {
  const breaker = new CircuitBreaker({ timeoutMs: 100 });

  await expect(
    breaker.execute(() => new Promise(() => {})) // Never resolves
  ).rejects.toThrow('Timeout');
});
```

## Test Checklist

- [ ] Starts closed
- [ ] Counts failures
- [ ] Opens at threshold
- [ ] Fails fast when open
- [ ] Transitions to half-open
- [ ] Closes on success in half-open
- [ ] Re-opens on failure in half-open
- [ ] Respects timeout
- [ ] Cleans up old failures
- [ ] Thread-safe (if applicable)
