# Three Wrong Ways to Implement Bulkheads

---

## Wrong #1: Shared Pool

One pool for everything. Slow operations block fast ones.

---

## Wrong #2: No Queue Limits

Unbounded queue. Memory grows indefinitely.

---

## Wrong #3: No Rejection

Requests wait forever. Never fail fast.
