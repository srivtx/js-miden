# CRITIQUE: Metrics Collector

## Senior Engineer Review

### What's Missing

#### 1. No Automatic Cleanup / Retention

**Current state:** Metrics accumulate forever.
**What's missing:** Time-based eviction.

**Impact:**
- Memory grows unbounded
- Process crashes after hours/days
- Even with time-window filtering, raw data stays in memory

**Fix:**
```typescript
record(name: string, value: number, tags: Record<string, string> = {}): void {
  // ... record metric ...
  this.cleanup(name, this.retentionMs);
}

private cleanup(name: string, retentionMs: number): void {
  const cutoff = Date.now() - retentionMs;
  const records = this.metrics.get(name);
  if (records) {
    const valid = records.filter(r => r.timestamp > cutoff);
    this.metrics.set(name, valid);
  }
}
```

#### 2. No Pre-Aggregation

**Current state:** Sorts all records on every query.
**What's missing:** Running statistics or histogram buckets.

**Impact:**
- O(n log n) queries become slow with many records
- CPU spikes during dashboard refreshes

#### 3. No Metric Export Format

**Current state:** Custom JSON format.
**What's missing:** Prometheus exposition format or OpenTelemetry protocol.

**Impact:**
- Can't integrate with standard tools (Grafana, Prometheus)
- Custom visualization required

#### 4. No Dimensions / Tag Indexing

**Current state:** Tags are stored but not indexed.
**What's missing:** Query by tag values.

**Impact:**
- Can't answer: "What's the P95 for endpoint /api/users?"
- All tags are treated as a single series

#### 5. No Sampling for High-Frequency Metrics

**Current state:** Every metric is recorded.
**What's missing:** Sampling for very high-frequency events.

**Impact:**
- At 10,000 requests/sec, recording every metric adds overhead
- Sampling (e.g., 1%) reduces overhead with minimal accuracy loss

### Security Concerns

#### 1. No Input Validation on Tags

```typescript
collector.record(name, value, tags || {});
```

**Risk:** Tags could contain:
- Very large objects (memory exhaustion)
- Circular references (crash on JSON.stringify)
- Prototype pollution keys (`__proto__`, `constructor`)

**Fix:**
```typescript
function sanitizeTags(tags: any): Record<string, string> {
  if (typeof tags !== 'object' || tags === null) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (typeof value === 'string' && key.length < 100 && value.length < 1000) {
      result[key] = value;
    }
  }
  return result;
}
```

#### 2. No Rate Limiting on POST /metrics

**Risk:** An attacker could flood the endpoint, causing:
- Memory exhaustion
- Disk exhaustion (if persisting)
- CPU exhaustion (from aggregation)

**Fix:** Add rate limiting middleware.

#### 3. Information Disclosure via GET /metrics

**Risk:** Returns all metric names and values. Could leak:
- Internal endpoint names
- Performance characteristics
- Business metrics (revenue, user counts)

**Fix:**
- Require authentication
- Redact sensitive metric names
- Provide only aggregated data, not raw values

#### 4. ReDoS via Metric Names

If metric names are used in regex anywhere:
```typescript
// Hypothetical:
const regex = new RegExp(req.query.filter);
```

**Risk:** Metric names are attacker-controlled input. Malicious regex can cause CPU exhaustion.

**Fix:** Don't use user input in regex. If necessary, use RE2 (safe regex engine).

### Architecture Concerns

#### 1. Single-Threaded Sorting Blocks Event Loop

```typescript
const values = records.map(r => r.value).sort((a, b) => a - b);
```

For 1M records, this blocks the event loop for ~100ms.

**Fix:** Use worker threads for large aggregations, or maintain pre-sorted structures.

#### 2. No Backpressure

If metrics are recorded faster than they can be queried/aggregated, memory grows.

**Fix:** Implement a ring buffer with overwrite (like Prometheus).

#### 3. Test Reliance on Internal State Mutation

```typescript
beforeEach(() => {
  (collector as any).metrics = new Map();
});
```

**Smell:** Tests access private state. Better to add a `clear()` method.

### Recommendations for Production

| Priority | Item | Effort |
|----------|------|--------|
| P0 | Add automatic cleanup/retention | 1 day |
| P0 | Add input validation and sanitization | 1 day |
| P0 | Add rate limiting | 0.5 day |
| P1 | Add Prometheus exposition format | 2 days |
| P1 | Add tag-based querying | 3 days |
| P2 | Use pre-bucketed histograms | 2 days |
| P2 | Add sampling support | 1 day |
| P2 | Move aggregation to worker threads | 2 days |
