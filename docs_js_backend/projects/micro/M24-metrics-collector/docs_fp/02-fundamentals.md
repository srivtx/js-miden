# Fundamentals: Percentiles from Scratch

**Task:** Calculate P99 latency without storing all values.

Given: You have 1 million request durations. You need P99.

---

## Multiple Choice: Percentile Calculation

**Q:** How do you calculate P99 efficiently?

**A)** Sort all values, pick index 990,000

**B)** Use a histogram with buckets

**C)** Keep a running sum and count

**D)** Both A and B

**Think before reading on.**

---

## The Answer

**D is correct.**

- **A:** Accurate but O(n log n) and O(n) memory. Doesn't scale.
- **B:** Approximate but O(1) memory. Fast. Good enough for monitoring.
- **C)** Running sum gives mean, not percentiles.

**For production monitoring, histograms are standard.**
