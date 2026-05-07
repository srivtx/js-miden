# Thinking Exercises

## 1. The Cardinality

You have 1 million users. Should you track latency per user?

**Question:** What's the cardinality impact? What's the alternative?

---

## 2. The Aggregation

You need P99 latency. But you have 10 servers.

**Question:** Can you average P99s across servers? Why not?

---

## 3. The Sampling

100% of requests generate metrics. Metrics system can't keep up.

**Question:** Do you sample? What's the minimum viable sampling rate?

---

## 4. The Alert

P99 latency spikes from 100ms to 5s.

**Question:** Is it an outage? Or one slow request out of 100?

---

## 5. The Cost

Metrics cost $0.50/GB ingested. You're ingesting 1TB/day.

**Question:** What do you keep? What do you drop?
