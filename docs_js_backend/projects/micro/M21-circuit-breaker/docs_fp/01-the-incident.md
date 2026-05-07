# The 3AM Page: The Cascade Failure

It's 3:00 AM. Everything is down.

**Monitoring:** Payment service latency > 30s. Inventory service timing out. User service unresponsive.

You check the logs. Every service is retrying every request. Threads are exhausted. Memory is full.

**The payment service went down. Every other service kept trying to reach it.**

No circuit breaker. No timeout. Just endless retries.

**Result:** Payment service + all dependent services = total outage.

---

## Your Turn

### Q1: Why do retries make outages worse?

Shouldn't retrying help recover from failures?

<br><br><br><br><br>

---

## The Autopsy

### Answer: Retries amplify load

If a service is down:
- 1 request fails
- Retry × 3 = 3 failed requests
- 10 services retrying = 30 failed requests
- Each retry holds a connection/thread for the timeout duration

**You're DDoS-ing yourself.**

### The Circuit Breaker Pattern

```
CLOSED  →  OPEN  →  HALF-OPEN  →  CLOSED
(normal)   (failing)  (testing)    (recovered)
```

- **CLOSED:** Requests pass through. Count failures.
- **OPEN:** Too many failures. Reject immediately. Fail fast.
- **HALF-OPEN:** After timeout, allow 1 test request.
  - Success → CLOSED
  - Failure → OPEN

**This prevents cascade failures by failing fast.**
