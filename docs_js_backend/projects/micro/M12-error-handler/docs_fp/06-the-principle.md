# The Principle: What Did Error Handling Teach You?

## The Fundamental Truth

> **"An error you don't handle is a vulnerability you haven't found yet."**

## The Junior Question

A junior dev says: "I'll just wrap everything in try/catch and return 500."

**What's wrong with this?**

<br><br><br><br><br>

---

## The Answer

Not all errors are equal:
- **Validation errors (400):** Client sent bad data. Their fault.
- **Auth errors (401/403):** Client isn't allowed. Their fault.
- **Not found (404):** Resource doesn't exist. Might be client's fault.
- **Server errors (500):** Your fault. Log immediately. Fix immediately.
- **Dependency errors (502/503):** Downstream service failed. Not your fault, but your problem.

**Returning 500 for everything:**
- Makes debugging harder (can't distinguish client vs server errors)
- Wastes engineering time investigating "bugs" that are user errors
- Violates HTTP semantics

## The Realization

Error handling is not about preventing crashes. It's about:
1. **Classifying failures** (whose fault is it?)
2. **Containing blast radius** (don't leak internals)
3. **Enabling recovery** (can the user retry? should you retry?)
4. **Providing context** (request ID, correlation ID, user ID)

Good error handling makes your system **observable** and **resilient**.
