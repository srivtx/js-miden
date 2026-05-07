# The 3AM Page: The Memory Bomb

It's 3:00 AM. Your server crashed.

**Monitoring:** "OOM killed. Memory usage grew from 200MB to 8GB in 2 hours."

You check the metrics code:
```javascript
const metrics = [];

app.use((req, res, next) => {
  metrics.push({
    path: req.path,
    duration: Date.now() - start,
    timestamp: Date.now()
  });
  next();
});
```

**No limit. No cleanup. Every request adds an object. Forever.**

At 1000 req/s:
- 1,000 objects/second
- 86,400,000 objects/day
- Each object ~100 bytes
- 8.6GB/day

**Your metrics system is a memory leak.**

---

## Your Turn

### Q1: Why keep all metrics in memory?

Don't you need them for analysis?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Memory is not storage

Metrics should be:
- **Aggregated:** Count, mean, percentiles — not individual events
- **Time-windowed:** Last 1 minute, 5 minutes, 1 hour
- **Offloaded:** Send to Prometheus, Datadog, CloudWatch

**Storing raw events in memory is an anti-pattern.**

### The Fix: Sliding Window

```javascript
class MetricsWindow {
  constructor(windowMs) {
    this.windowMs = windowMs;
    this.buckets = new Map(); // timestamp -> count
  }

  record(duration) {
    const bucket = Math.floor(Date.now() / 1000) * 1000;
    this.buckets.set(bucket, (this.buckets.get(bucket) || 0) + 1);
    this.cleanup();
  }

  cleanup() {
    const cutoff = Date.now() - this.windowMs;
    for (const [time, _] of this.buckets) {
      if (time < cutoff) this.buckets.delete(time);
    }
  }
}
```

**Bounded memory. O(number of buckets), not O(number of requests).**
