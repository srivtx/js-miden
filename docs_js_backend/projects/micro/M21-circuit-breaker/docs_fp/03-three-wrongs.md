# Three Wrong Ways to Implement Circuit Breakers

---

## Wrong #1: No Half-Open State

```javascript
if (failures > 5) {
  // Wait 30 seconds, then immediately go back to CLOSED
}
```

**Why it's wrong:** If the service is still down, you immediately flood it again.

---

## Wrong #2: Global Circuit

```javascript
const circuit = new CircuitBreaker();
// All services share one circuit!
```

**Why it's wrong:** One flaky service opens the circuit for ALL services.

**Fix:** Per-service circuits.

---

## Wrong #3: No Fallback

```javascript
if (circuit.isOpen) {
  throw new Error('Service unavailable');
}
```

**Why it's wrong:** The user sees an error. Better to return cached data or default values.
