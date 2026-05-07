# Impossible Constraint: No State Storage

**Task:** Build a circuit breaker with no memory.

**Constraint:** You can't store state (no variables, no objects).

---

## Your Turn

How do you track failures without storing state?

**Write your approach:**

<br><br><br><br><br>

---

## The Reveal: You Can't

A circuit breaker IS state. Without state, you can't count failures or track timeouts.

**This constraint forces you to realize:**

> State is not optional in distributed systems. The question is where to store it.

- **In-process:** Fast, but lost on restart
- **Redis:** Shared across instances, but adds latency
- **Database:** Persistent, but slow

**Choose based on your consistency requirements.**
