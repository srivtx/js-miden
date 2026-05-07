# Impossible Constraint: No Clock

**Task:** Implement backoff without any timing functions.

**Constraint:** No `setTimeout`, `setInterval`, `Date.now()`, or `sleep`.

---

## Your Turn

How do you delay retries without a clock?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: You Can't (Easily)

Without timing, you can't delay. But you can:
- **Busy-wait:** Waste CPU cycles (terrible)
- **Event-based:** Wait for an event (not really a delay)
- **Queue:** Push to a queue with a scheduled delivery time

**The point:** Timing is fundamental to retries. Without it, you need external infrastructure (queues, schedulers).

**This constraint forces you to realize:**

> Retries require either time (delay) or infrastructure (queues). In-process retries with setTimeout are simple but limited. Queue-based retries are robust but complex.
