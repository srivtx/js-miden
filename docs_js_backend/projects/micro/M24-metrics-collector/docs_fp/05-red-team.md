# Red Team: Metric Attacks

---

## Attack 1: Cardinality Bomb

**Payload:** Send requests with unique path: `/api/track/${randomUUID()}`

**Impact:** Creates millions of time series. Metrics system OOMs.

---

## Attack 2: Label Injection

**Payload:** Send `X-Custom-Metric: error_${sqlInjection}`

**Impact:** Metric labels contain SQL injection. Metrics database compromised.

---

## Attack 3: Slow Metric Collection

**Payload:** Trigger expensive metric calculations.

**Impact:** Metric collection blocks request handling.
