# The Principle: What Did Retries Teach You?

## The Fundamental Truth

> **"Retries are a promise to try again. But promises without limits become threats."**

## The Junior Question

A junior dev says: "I'll just retry until it works."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

"Until it works" means:
- If the service is down for 1 hour, you retry for 1 hour
- Holding connections, memory, and CPU the entire time
- Potentially creating millions of failed requests

**Bounded retries are essential.**

## The Realization

Retry strategy is a **resilience pattern**, not a fix-all:
- **Retry:** For transient failures
- **Backoff:** To avoid overwhelming
- **Jitter:** To desynchronize
- **Circuit breaker:** To stop retrying persistent failures
- **Fallback:** To degrade gracefully

**Use all of them together.**
