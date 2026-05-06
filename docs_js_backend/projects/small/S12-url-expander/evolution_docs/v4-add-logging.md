# v4 — Adding Logging

A user reports that expanding `https://example.com/slow` hangs forever. You try it. It hangs. You have no idea why.

After 5 minutes, you realize the server never responds and you never set a timeout. The connection just sits there. If you had logs, you'd see the request start time and know immediately.

## The Fix: Structured Logging + Timeouts

You add `pino` and a 5-second timeout per hop.

```ts
import pino from 'pino';
const logger = pino();

function requestUrl(url: string, method: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(parsed, { method, timeout: 5000 }, (res) => {
      res.resume();
      resolve(res);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}
```

Now:
- Slow servers → timeout after 5 seconds
- Hung connections → destroyed after 5 seconds
- Every hop is logged

```ts
logger.info({ url, method, durationMs }, 'HTTP request completed');
logger.error({ url, error: err.message }, 'HTTP request failed');
```

## Why This Matters

Without timeouts, a single malicious or slow URL can exhaust your connection pool. Without logs, you can't tell what's happening.

**Next:** Let's write tests so SSRF stays fixed.
