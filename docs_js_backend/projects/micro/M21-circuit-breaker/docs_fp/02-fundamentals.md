# Fundamentals: State Machine from Scratch

**Task:** Implement a circuit breaker using only JavaScript.

States:
- CLOSED: Allow requests, track failures
- OPEN: Reject requests immediately
- HALF-OPEN: Allow 1 test request

---

## Multiple Choice: Failure Threshold

**Q:** When should the circuit OPEN?

**A)** After 1 failure (too sensitive)

**B)** After 50% failure rate in last 10 requests

**C)** After 5 consecutive failures

**D)** All of the above, depending on the service

**Think before reading on.**

---

## The Answer

**D is correct.**

Different services need different thresholds:
- **Critical payment service:** Open after 3 failures (fail fast)
- **Non-critical analytics:** Open after 20 failures (tolerate flakiness)
- **External API:** Open after 50% failure rate (network blips)

**The threshold is a business decision, not a technical one.**
