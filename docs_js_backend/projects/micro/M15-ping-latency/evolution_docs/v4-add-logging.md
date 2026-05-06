# M15 Ping API — v4 Add Logging

## The Bug: Production Visibility Crisis

You deploy v3. Support ticket arrives: *"Latency endpoint is slow sometimes."*

You SSH into the box. You add `console.log` statements and restart. It works now. You remove them. It breaks again. You have zero visibility into:

- Which targets are being probed
- How long DNS resolution takes vs TCP connection
- How many requests are blocked by SSRF rules
- Whether connections are hanging

```ts
// Without logging — silent failure
app.get('/latency', async (req, res) => {
  const target = req.query.target as string;
  const result = await measureLatency(target);
  res.json(result); // If this hangs, you never know why
});
```

## The Fix: Structured Logging

```ts
import { logger } from './logger.js'; // pino or winston

app.get('/latency', async (req, res) => {
  const target = req.query.target as string;
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  logger.info({ requestId, target }, 'Latency request received');

  try {
    const result = await measureLatency(target, requestId);
    logger.info({ requestId, result }, 'Latency measured successfully');
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ requestId, target, error: message }, 'Latency measurement failed');
    res.status(403).json({ error: message });
  }
});
```

```ts
// In latency.ts
export async function measureLatency(target: string, requestId: string) {
  const host = target.split(':')[0];
  logger.debug({ requestId, host }, 'Starting DNS resolution');

  const dnsStart = performance.now();
  const addresses = await lookup(host);
  const dnsTime = performance.now() - dnsStart;
  logger.debug({ requestId, ip: addresses.address, dnsTime }, 'DNS resolved');

  // ...

  const socket = new net.Socket();
  const timeout = setTimeout(() => {
    socket.destroy();
    logger.warn({ requestId, target, timeoutMs: 5000 }, 'Connection timeout');
    reject(new Error('Connection timeout'));
  }, 5000);

  // ...
}
```

Now your logs tell the story:
```json
{"level":"info","requestId":"abc","target":"example.com","msg":"Latency request received"}
{"level":"debug","requestId":"abc","ip":"93.184.216.34","dnsTime":12,"msg":"DNS resolved"}
{"level":"warn","requestId":"abc","target":"example.com","timeoutMs":5000,"msg":"Connection timeout"}
```

## The Pain That Remains

You add a new feature: blocking IPv6 link-local addresses. You add `/^fe80:/i` to `BLOCKED_RANGES`. You deploy. Two weeks later, someone reports that `localhost` is no longer blocked. You accidentally deleted `localhost` from `BLOCKED_HOSTS` during the same commit. No test caught it.

## What v5 Fixes

Testing. Silent breakage when adding features is unacceptable.
