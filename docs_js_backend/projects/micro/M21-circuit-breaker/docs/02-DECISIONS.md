# DECISIONS: Circuit Breaker

## Decision 1: In-Memory vs External State Store

### Option A: In-Memory State (What We Chose)

```typescript
private state: CircuitState = 'closed';
private failures: FailureRecord[] = [];
```

**Pros:**
- Zero latency (no network call)
- Zero infrastructure dependencies
- Simple to implement and test
- Works perfectly for single-instance services

**Cons:**
- Lost on process restart
- Doesn't work across load-balanced instances
- Each instance has its own threshold count

**What if wrong?** If we scale to 3 instances behind a load balancer, each instance needs 5 failures to open. A user could experience 15 failures before any instance opens. We'd need to migrate to external state.

### Option B: Redis-Backed State

```typescript
async getState(): Promise<CircuitState> {
  return await redis.get(`breaker:${service}:state`) as CircuitState;
}
```

**Pros:**
- Shared across all instances
- Survives restarts
- Can be monitored centrally

**Cons:**
- Added latency (~1-5ms per request)
- Redis becomes a dependency (needs its own breaker!)
- More complex operations (atomic updates, race conditions)
- Infrastructure cost

**Why we chose A:** This is a micro-project teaching the pattern. In-memory is correct for the scope. Production systems at scale use Redis or service meshes.

---

## Decision 2: Count-Based vs Rate-Based Failure Detection

### Option A: Count-Based (What We Chose)

```typescript
if (this.failures.length >= this.options.failureThreshold) {
  this.state = 'open';
}
```

**Pros:**
- Simple to understand and implement
- Predictable behavior
- Fast to compute (array.length)

**Cons:**
- Ignores total request volume (5 failures out of 5 is different from 5 out of 10000)
- Can trigger on brief blips

### Option B: Rate-Based (Success Rate Threshold)

```typescript
const failureRate = failures.length / totalRequests.length;
if (failureRate > 0.5 && totalRequests.length > 10) {
  this.state = 'open';
}
```

**Pros:**
- Statistically robust
- Adapts to traffic volume
- Fewer false positives

**Cons:**
- Requires tracking ALL requests (success + failure)
- More memory usage
- Harder to tune (what's the minimum sample size?)

**Why we chose A:** Count-based is the industry standard for simple breakers (Hystrix, Resilience4j default). Rate-based is better but adds complexity. We document this as a future enhancement.

---

## Decision 3: Promise.race vs Manual Timeout

### Option A: Manual Timeout with clearTimeout (What We Chose)

```typescript
private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, this.options.timeoutMs);

    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}
```

**Pros:**
- Works with all Promise implementations
- No unhandled rejection warnings
- Explicit cleanup of timer

**Cons:**
- The underlying request continues running (zombie promises)
- Slightly more code

### Option B: Promise.race

```typescript
private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}
```

**Pros:**
- Concise, readable
- Standard pattern

**Cons:**
- Losing race doesn't cancel the other promise
- Can cause unhandled rejection if fn() rejects after timeout
- No cleanup of the timer

**Why we chose A:** The manual approach gives us control over cleanup and avoids unhandled rejection edge cases. In Node.js, the timer cleanup is important for event loop health.

---

## Decision 4: Per-Request Timeout vs Bulkhead Isolation

### Option A: Per-Request Timeout (What We Chose)

Each request has its own timeout.

**Pros:** Simple, standard
**Cons:** Doesn't limit concurrent requests

### Option B: Bulkhead Pattern (Semaphore)

```typescript
const semaphore = new Semaphore(10); // Max 10 concurrent
```

**Pros:** Limits total concurrent calls to the service
**Cons:** Different pattern, different problem

**Why we chose A:** Bulkheads and circuit breakers solve different problems. Breakers detect failure patterns; bulkheads limit concurrency. In production, use both (Hystrix combines them).
