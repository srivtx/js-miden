# Red Team: Breaking Circuit Breakers

---

## Attack 1: Slowloris

**Payload:** Send requests that hang just under the timeout.

**Impact:** Circuit never opens (not enough failures). Threads exhausted.

---

## Attack 2: Flapping

**Payload:** Service recovers for 1 second, fails for 1 second, repeat.

**Impact:** Circuit toggles between OPEN and HALF-OPEN constantly. Unpredictable behavior.

---

## Attack 3: Partial Failure

**Payload:** 50% of endpoints fail, 50% work.

**Impact:** Global circuit opens even though some functionality works.

**Fix:** Per-endpoint circuits, not per-service.
