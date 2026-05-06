# OLD vs NEW: Retry Logic

## Pattern 1: No Retries (2015)

### Old Code

```typescript
// 2015: "If it fails, it fails"
async function fetchData(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
```

**Why it was done:** Simple. Assumes networks are reliable.

**Why it's wrong now:**
- 1% failure rate becomes 1% user-facing errors
- At 1M requests/day, that's 10,000 angry users
- Doesn't distinguish transient from permanent failures
- No recovery from brief blips

### New Code (2025)

```typescript
// 2025: Resilient with retries
async function fetchData(url: string): Promise<any> {
  const client = new RetryClient({
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 16000,
    timeoutMs: 10000,
  });
  return client.fetch(url);
}
```

**Why it's better:**
- Transient failures are invisible to users
- Exponential backoff gives services recovery time
- Jitter prevents thundering herd
- Timeouts prevent indefinite hangs

---

## Pattern 2: Naive Retry Loop (2016-2018)

### Old Code

```typescript
// 2017: Retry with fixed delay
async function fetchWithRetry(url: string): Promise<any> {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch (e) {
      await sleep(1000); // Always 1 second
    }
  }
  throw new Error('Max retries exceeded');
}
```

**Why it was done:** Better than no retries. Simple to implement.

**Why it's wrong now:**
- Fixed delay doesn't give overloaded services recovery time
- No jitter = thundering herd when service recovers
- Retries on 4xx errors
- No timeout = can hang forever

### New Code (2025)

```typescript
// 2025: Exponential backoff with jitter
class RetryClient {
  async fetch(url: string): Promise<{ status: number; data: string }> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        const data = await response.text();

        if (!response.ok) {
          // Only retry 5xx and timeouts
          if (response.status >= 500 || response.status === 429) {
            throw new Error(`HTTP ${response.status}: ${data}`);
          }
          return { status: response.status, data };
        }

        return { status: response.status, data };
      } catch (error: any) {
        lastError = error;

        const isTimeout = error.name === 'AbortError';
        const is5xx = error.message?.includes('HTTP 5');

        if (!isTimeout && !is5xx) {
          throw error; // Don't retry non-retryable errors
        }

        if (attempt < this.options.maxRetries) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  private calculateDelay(attempt: number): number {
    const exponential = Math.min(
      this.options.baseDelayMs * Math.pow(2, attempt),
      this.options.maxDelayMs
    );
    const jitter = Math.random() * exponential;
    return jitter;
  }
}
```

**Why it's better:**
- Exponential backoff gives recovery time
- Jitter prevents synchronized surges
- Only retries appropriate errors
- Proper timeout handling with AbortController

---

## Pattern 3: Application-Level Retry vs Service Mesh Retry (2015-2020 vs 2025)

### Old Approach: Every Service Implements Its Own Retry (2015-2020)

```typescript
// Order Service
import axios from 'axios';
const paymentClient = axios.create({ retries: 3, retryDelay: 1000 });

// Inventory Service
import fetchRetry from 'fetch-retry';
const fetch = fetchRetry(global.fetch, { retries: 3 });

// Shipping Service
// No retries at all!
```

**Why it was done:** Each team chose their own library.

**Why it's wrong now:**
- Inconsistent retry behavior
- Retry amplification (3 layers x 3 retries = 9x load)
- Some services have no protection
- Configuration scattered in code

### New Approach: Service Mesh Retry (2025)

```yaml
# Istio VirtualService (2025)
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: payment-service
spec:
  hosts:
    - payment-service
  http:
    - route:
        - destination:
            host: payment-service
      retries:
        attempts: 3
        perTryTimeout: 2s
        retryOn: gateway-error,connect-failure,refused-stream
```

**Why it's better:**
- Uniform retries across all services
- No code changes needed
- Centralized configuration
- Can combine with circuit breakers
- Automatic retry budget (prevents amplification)

**When to still use application-level:**
- External API calls (outside the mesh)
- Custom retry logic (e.g., refresh token on 401)
- Idempotency key management

---

## Pattern 4: Callback-Based Retry (2015) vs Async/Await Retry (2025)

### Old Code

```javascript
// 2015: Callback hell with retry
function fetchWithRetry(url, callback, attempt = 0) {
  fetch(url, (err, res) => {
    if (err && attempt < 3) {
      setTimeout(() => fetchWithRetry(url, callback, attempt + 1), 1000);
    } else {
      callback(err, res);
    }
  });
}
```

**Why it was done:** Pre-Promise JavaScript.

**Why it's wrong now:**
- Callback hell
- Error handling is scattered
- Hard to compose
- No async/await ergonomics

### New Code (2025)

```typescript
// 2025: Clean async/await
async function fetchWithRetry(url: string): Promise<Response> {
  const client = new RetryClient();
  return client.fetch(url);
}

// Usage:
const result = await fetchWithRetry('/api/data');
```

**Why it's better:**
- Linear, readable code
- Centralized error handling
- Composable with other async operations
- Try/catch works naturally
