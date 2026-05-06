# OLD vs NEW: Circuit Breaker

## Pattern 1: Naive Retry Loop (2015)

### Old Code

```typescript
// 2015-style: Just retry forever
async function callApi(url: string): Promise<any> {
  while (true) {
    try {
      return await fetch(url);
    } catch (e) {
      console.log('Failed, retrying in 1s...');
      await sleep(1000);
    }
  }
}
```

**Why it was done:** Simple to understand. "If it fails, try again." Many developers didn't understand distributed systems failure modes.

**Why it's wrong now:**
- Retries on permanent failures (4xx) waste resources
- No backoff causes thundering herd
- No timeout = indefinite hangs
- If the service is down, you're DDoS-ing it with retries
- Cascading failure risk

### New Code (2025)

```typescript
// 2025: Circuit breaker + timeout + backoff
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  failureWindowMs: 60000,
  halfOpenTimeoutMs: 30000,
  timeoutMs: 5000,
});

async function callApi(url: string): Promise<any> {
  return breaker.execute(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } finally {
      clearTimeout(timeout);
    }
  });
}
```

**Why it's better:**
- Fails fast when service is unhealthy
- Gives downstream service recovery time
- Bounded resource usage
- Observable state and metrics

---

## Pattern 2: Global Try/Catch with Logging (2015-2018)

### Old Code

```typescript
// Express route with basic error handling (2017)
app.get('/orders', async (req, res) => {
  try {
    const orders = await fetchFromOrderService();
    res.json(orders);
  } catch (error) {
    console.error('Order service error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Why it was done:** Standard Express error handling. Logs the error, returns 500. Seems reasonable.

**Why it's wrong now:**
- Every request still hits the failing service
- No distinction between transient and permanent failures
- 500 status is wrong for downstream failures (should be 502/503)
- No protection for the order service
- Users wait for full timeout before seeing error

### New Code (2025)

```typescript
app.get('/orders', async (req, res) => {
  try {
    const orders = await orderServiceBreaker.execute(
      () => fetchFromOrderService()
    );
    res.json(orders);
  } catch (error: any) {
    if (error.statusCode === 503) {
      // Circuit is open - fail fast, return cached data
      return res.json(await getCachedOrders());
    }
    res.status(502).json({ error: 'Order service temporarily unavailable' });
  }
});
```

**Why it's better:**
- Returns 502/503 with correct semantics
- Graceful degradation with cached data
- Protects both caller and callee
- Fast response even during outages

---

## Pattern 3: Per-Service Breaker vs Service Mesh (2015-2020 vs 2025)

### Old Approach: Application-Level Breakers (2015-2020)

Every service implements its own circuit breaker library.

```typescript
// Order Service
import { CircuitBreaker } from 'hystrix-js';

// Payment Service
import { CircuitBreaker } from 'our-internal-lib';

// Inventory Service
// No breaker at all!
```

**Why it was done:** Each team chose their own library. Some didn't implement breakers at all. No standardization.

**Why it's wrong now:**
- Inconsistent behavior across services
- Some services have no protection
- Configuration scattered in code
- Hard to monitor and tune centrally

### New Approach: Service Mesh (2025)

```yaml
# Istio DestinationRule (2025 standard)
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: payment-service
spec:
  host: payment-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
    outlierDetection:
      consecutiveErrors: 5
      interval: 60s
      baseEjectionTime: 30s
```

**Why it's better:**
- Uniform breakers across all services
- No code changes needed
- Centralized monitoring via Prometheus/Grafana
- Language-agnostic (works for Go, Java, Node.js)
- Can be tuned by platform team without deploys

**When to still use application-level:**
- When you need custom fallback logic (caching, defaults)
- When calling external APIs (Stripe, SendGrid) outside the mesh
- When the service mesh doesn't support the specific pattern you need
