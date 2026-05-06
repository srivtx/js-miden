# CRITIQUE: Retry Logic

## Senior Engineer Review

### What's Missing

#### 1. No Idempotency Key Support

**Current state:** Retries any request, including POST.
**What's missing:** Idempotency key generation and propagation.

**Impact:**
- Retrying POST requests can create duplicate resources
- Retrying payment charges can double-charge customers
- Retrying webhook deliveries can trigger duplicate actions

**Fix:**
```typescript
async fetch(url: string, options?: RequestInit & { idempotent?: boolean }): Promise<Response> {
  const idempotencyKey = options?.idempotent ? crypto.randomUUID() : undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const headers = idempotencyKey
      ? { ...options?.headers, 'Idempotency-Key': idempotencyKey }
      : options?.headers;
    
    try {
      return await fetch(url, { ...options, headers });
    } catch (error) {
      // ... retry logic ...
    }
  }
}
```

#### 2. No Retry Budget

**Current state:** Fixed 3 retries, always.
**What's missing:** Adaptive retry limits based on system health.

**Impact:**
- During widespread outages, all clients retry simultaneously
- Can overload recovery efforts
- No circuit breaker integration

**Fix:** Implement a retry budget or integrate with a circuit breaker.

#### 3. No Request/Response Logging

**Current state:** Silent retries.
**What's missing:** Observability into retry behavior.

**Impact:**
- Can't debug why requests fail
- Can't tune retry parameters
- No alerting on high retry rates

**Fix:**
```typescript
logger.warn(`Retry ${attempt + 1}/${maxRetries} for ${url}`, {
  attempt,
  delay,
  error: error.message,
});
```

#### 4. No Custom Retry Conditions

**Current state:** Hardcoded retry logic.
**What's missing:** User-defined retry predicates.

**Impact:**
- Can't retry on custom error codes
- Can't skip retry for specific 5xx errors
- Inflexible for different use cases

**Fix:**
```typescript
interface RetryOptions {
  // ...
  shouldRetry?: (error: Error, response?: Response) => boolean;
}
```

#### 5. No Connection Pooling

**Current state:** Uses global `fetch()`.
**What's missing:** Keep-alive connections and connection reuse.

**Impact:**
- TCP handshake overhead on every request
- Port exhaustion under high load
- Slower overall performance

### Security Concerns

#### 1. SSRF via URL Parameter

```typescript
app.get('/fetch', async (req, res) => {
  const { url } = req.query;
  const result = await client.fetch(url);
});
```

**Risk:** An attacker can fetch internal services:
```
/fetch?url=http://localhost:22/       # SSH banner
/fetch?url=http://169.254.169.254/    # AWS metadata
/fetch?url=http://internal-api/       # Internal services
```

**Fix:**
```typescript
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    // Block private IP ranges
    const hostname = parsed.hostname;
    if (hostname === 'localhost') return false;
    if (hostname.startsWith('127.')) return false;
    if (hostname.startsWith('10.')) return false;
    if (hostname.startsWith('192.168.')) return false;
    if (hostname.startsWith('169.254.')) return false;
    return true;
  } catch {
    return false;
  }
}
```

#### 2. No Request Size Limits

**Risk:** An attacker could request a massive file, causing:
- Memory exhaustion (`response.text()` loads entire body into memory)
- Bandwidth exhaustion

**Fix:**
```typescript
const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB
const data = await response.text();
if (data.length > MAX_RESPONSE_SIZE) {
  throw new Error('Response too large');
}
```

#### 3. No Rate Limiting

**Risk:** An attacker can trigger expensive retry operations:
```
/fetch?url=http://slow-server.com/  # 4 retries x 10s timeout = 40s per request
```

**Fix:** Add rate limiting and max URL count per IP.

#### 4. Information Disclosure in Error Messages

```typescript
res.status(502).json({
  url,
  error: error.message,
  retriesExhausted: true,
});
```

**Risk:** Error messages may contain:
- Internal hostnames
- Stack traces (if not handled)
- Implementation details

**Fix:**
```typescript
res.status(502).json({
  error: 'Failed to fetch URL after retries',
});
```

### Architecture Concerns

#### 1. Retry Logic Tied to fetch()

**Current state:** `RetryClient.fetch()` only works with HTTP.
**What's missing:** Generic retry wrapper for any async function.

**Fix:**
```typescript
async execute<T>(fn: () => Promise<T>): Promise<T> {
  // Same retry logic, works with any Promise
}
```

#### 2. No Cancellation from Caller

**Current state:** AbortController is internal.
**What's missing:** Caller can't cancel a retry loop.

**Fix:** Accept an external AbortSignal:
```typescript
async fetch(url: string, signal?: AbortSignal): Promise<Response> {
  // Use provided signal or create internal one
}
```

#### 3. Test Reliance on Internal State

Tests directly manipulate `requestCount` and `failWithStatus` on the mock server. This is acceptable for tests, but the production code has no hooks for observability.

### Recommendations for Production

| Priority | Item | Effort |
|----------|------|--------|
| P0 | Add SSRF protection | 1 day |
| P0 | Add response size limits | 0.5 day |
| P0 | Redact error messages | 0.5 day |
| P1 | Add idempotency key support | 2 days |
| P1 | Add retry logging/metrics | 1 day |
| P1 | Make retry logic generic | 1 day |
| P2 | Add retry budget | 2 days |
| P2 | Add custom retry predicates | 1 day |
| P2 | Add connection pooling | 1 day |
