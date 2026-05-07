# The Principle: What Did Metrics Teach You?

## The Fundamental Truth

> **"Metrics are a microscope. They show you what's happening. But they also cost memory, CPU, and disk. Don't measure everything. Measure what matters."**

## The Junior Question

A junior dev says: "Let's log every request with full headers and body for debugging."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

Full request logging:
- Violates GDPR/privacy (logs contain PII)
- Uses terabytes of disk
- Makes log analysis impossible (too much noise)
- Expensive (storage, ingestion, querying)

**Log sparingly. Metric aggressively. Trace selectively.**

## The Realization

The observability pyramid:
1. **Metrics:** Aggregated data (cheap, always on)
2. **Logs:** Event details (expensive, sampled)
3. **Traces:** Request flow (expensive, sampled)

**Use metrics for:**
- Latency (P50, P99)
- Throughput (requests/sec)
- Errors (error rate)
- Saturation (CPU, memory)

**Use logs for:**
- Debugging specific issues
- Audit trails
- Error details

**Use traces for:**
- Distributed system debugging
- Performance bottlenecks
