# CRITIQUE: Circuit Breaker

## Senior Engineer Review

### What's Missing

#### 1. No Fallback Mechanism

**Current state:** When the circuit opens, we throw a 503 error.
**What's missing:** The breaker should support fallback functions.

```typescript
// Missing:
const result = await breaker.execute(
  () => fetchFromPaymentService(),
  () => ({ status: 'degraded', cached: true, data: getCachedPricing() })
);
```

**Impact:** Users see errors instead of degraded but functional experiences.

#### 2. No Event Hooks / Observability

**Current state:** Metrics exposed via `/health` endpoint.
**What's missing:** Event emitters for state transitions.

```typescript
// Missing:
breaker.on('open', () => {
  metrics.increment('circuit_breaker.open', { service: 'payment' });
  alerting.sendPagerDuty('Payment circuit opened');
});
```

**Impact:** Ops teams discover circuit events via health checks instead of real-time alerts.

#### 3. Single-Instance Only

**Current state:** In-memory state.
**What's missing:** Distributed state for load-balanced deployments.

**Impact:** As noted in DECISIONS.md, 3 instances behind a load balancer each need 5 failures = 15 user-facing failures before any protection kicks in.

#### 4. No Bulkhead / Concurrency Limit

**Current state:** Any number of concurrent requests can be in-flight while the circuit is closed.
**What's missing:** Semaphore to limit concurrent calls.

**Impact:** A slow but not failing service (200ms instead of 10ms) can exhaust memory before the breaker opens.

#### 5. Static Configuration

**Current state:** Thresholds set at startup.
**What's missing:** Dynamic configuration updates.

```typescript
// Missing:
breaker.updateOptions({ failureThreshold: 10 }); // No restart needed
```

**Impact:** Tuning requires redeployment.

### Security Concerns

#### 1. Information Disclosure in Error Messages

```typescript
// Current:
const error = new Error('Circuit breaker is OPEN');
(error as any).statusCode = 503;
```

This is fine, but if the wrapped function's error leaks:

```typescript
catch (error: any) {
  res.status(status).json({ error: error.message, circuitState: breaker.getState() });
}
```

**Risk:** If `error.message` contains internal paths or stack traces, it leaks implementation details.

**Fix:**
```typescript
catch (error: any) {
  const status = error.statusCode || 500;
  const message = status === 503 ? 'Service temporarily unavailable' : 'Internal error';
  res.status(status).json({ error: message });
}
```

#### 2. No Rate Limiting on Health Endpoint

**Current state:** `/health` is unprotected.
**Risk:** An attacker could DDoS the health endpoint, or use it for reconnaissance.

**Fix:** Add rate limiting or authentication to `/health` in production.

#### 3. No Input Validation on Simulate Endpoint

```typescript
app.post('/simulate/fail', (req, res) => {
  shouldFail = req.body.fail ?? true; // No validation
});
```

**Risk:** This is a test endpoint, but if left in production, anyone can trigger failures.

**Fix:** Remove `/simulate/fail` in production builds, or protect it with admin auth.

#### 4. Memory Exhaustion via Metrics Endpoint

**Current state:** `/metrics` returns all data.
**Risk:** If there are millions of failure records (before cleanup), serializing them could cause memory spikes.

**Fix:** Cap the number of records returned or paginate.

### Architecture Concerns

#### 1. Tight Coupling to Express

The circuit breaker logic is sound, but `src/index.ts` couples it to Express. In production, the breaker should be a standalone module imported by any framework (Fastify, NestJS, plain HTTP).

#### 2. No Graceful Shutdown

```typescript
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => { ... });
}
```

**Missing:** SIGTERM handler to drain connections before exit.

#### 3. Test Reliance on Internal State Mutation

```typescript
(breaker as any).state = 'closed';
(breaker as any).failures = [];
```

**Smell:** Tests mutate private state. Better to add a `reset()` public method for testing.

### Recommendations for Production

| Priority | Item | Effort |
|----------|------|--------|
| P0 | Add fallback support | 1 day |
| P0 | Add event hooks | 0.5 day |
| P1 | Distributed state (Redis) | 3 days |
| P1 | Remove test endpoints in prod | 0.5 day |
| P2 | Bulkhead semaphore | 2 days |
| P2 | Dynamic configuration | 2 days |
| P2 | Add SIGTERM handler | 0.5 day |
