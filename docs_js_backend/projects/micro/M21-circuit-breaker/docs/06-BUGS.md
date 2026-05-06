# BUGS: Circuit Breaker

## The Intentional Bug: No Failure Threshold Check

### Location

`src/circuit-breaker.ts` - `onFailure()` method, lines 94-103

### How to Introduce

The threshold check code is commented out:

```typescript
private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();

  // BUG: No failure threshold check - circuit never opens!
  // The line below is intentionally missing:
  // if (this.failures.length >= this.options.failureThreshold) {
  //   this.state = 'open';
  //   this.lastOpenTime = Date.now();
  // }
}
```

### Why This Bug Exists

This bug simulates the most common circuit breaker anti-pattern: implementing state tracking but forgetting the actual state transition logic. It represents "we have monitoring but no protection." Many teams instrument failure counts but never wire them to protective action.

### Symptoms

1. **Health endpoint shows failures accumulating but state stays "closed"**
   ```
   GET /health
   { "state": "closed", "metrics": { "failuresInWindow": 47, "failureThreshold": 5 } }
   ```

2. **Every request returns 500 instead of 503**
   - 500 = actual service error (hitting the failing service)
   - 503 = circuit breaker rejection (what we want)

3. **Response times remain at timeout duration (5s)**
   - Should be <1ms when circuit is open

4. **No recovery time for downstream service**
   - Failing service receives every request

### Reproduction

```bash
# Start the service
npm start

# Trigger 10 failures
curl -X POST http://localhost:3000/simulate/fail -d '{"fail":true}'
for i in {1..10}; do
  curl http://localhost:3000/api/external
done

# Check health - state is still "closed"
curl http://localhost:3000/health
# Expected: { "state": "open", ... }
# Actual:   { "state": "closed", "metrics": { "failuresInWindow": 10 } }
```

**Failing test:**
```typescript
it('should open circuit after 5 failures in 60s', async () => {
  for (let i = 0; i < 5; i++) {
    await request(app).get('/api/external');
  }
  const res = await request(app).get('/api/external');
  expect(res.status).toBe(503); // FAILS - gets 500 instead
  expect(res.body.error).toContain('OPEN');
});
```

### The Fix

```typescript
private onFailure(): void {
  this.failures.push({ timestamp: Date.now() });
  this.cleanupOldFailures();

  if (this.failures.length >= this.options.failureThreshold) {
    this.state = 'open';
    this.lastOpenTime = Date.now();
  }
}
```

**Why the fix works:**
- After recording each failure, we check if the count exceeds the threshold
- If it does, we immediately transition to 'open' state
- We record `lastOpenTime` so `checkTransition()` knows when to attempt half-open
- The next request will see `state === 'open'` and return 503 in <1ms

### Real-World Impact

#### Case Study: Amazon DynamoDB Outage (2015)

On September 20, 2015, Amazon's DynamoDB service experienced an outage in the US-East-1 region. Services that lacked proper circuit breaker protection continued sending requests to DynamoDB, causing:

- **Cascading failures**: Services exhausted connection pools waiting for timeouts
- **Memory exhaustion**: Request queues filled up
- **Recovery prevention**: When DynamoDB began recovering, the thundering herd of accumulated requests overwhelmed it again

AWS later published that services with proper circuit breakers and exponential backoff recovered automatically, while those without required manual intervention.

#### Case Study: Knight Capital Trading Loss ($440M in 45 minutes)

In August 2012, Knight Capital deployed faulty trading software. The system lacked circuit breaker-like safety mechanisms:

- **No automatic halt**: The system continued sending erroneous orders
- **No failure threshold**: Millions of incorrect trades executed
- **45-minute window**: No one manually stopped the system
- **Result**: $440 million loss and near bankruptcy

While not a pure circuit breaker case, it illustrates the catastrophic cost of "continue on failure" logic.

#### Case Study: Facebook/Instagram Outage (2019)

A March 2019 configuration change caused a partial service degradation. Services without circuit breakers:

- Queued requests for 30+ seconds
- Exhausted thread pools
- Caused unrelated services to fail (cascading effect)

Facebook's post-mortem highlighted the need for better failure isolation, including circuit breaker patterns at the edge.

### Prevention

1. **Test-driven development**: Write the "circuit opens at threshold" test BEFORE the implementation
2. **Code review checklist**: "Does every failure path have a corresponding state transition?"
3. **Chaos engineering**: Use Netflix Chaos Monkey to randomly fail dependencies and verify breakers open
4. **Observability alerts**: Alert when `failures > threshold` but `state !== 'open'`
