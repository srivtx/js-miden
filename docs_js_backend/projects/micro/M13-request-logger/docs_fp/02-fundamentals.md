# M13 Request Logger: Fundamentals

## Strip the Libraries. Implement from Scratch.

You are not allowed to use `express`, `morgan`, `winston`, `pino`, or any logging middleware. You have:

- Node.js built-in `http`
- Node.js built-in `fs`

Build an HTTP server that logs every request with structured metadata and **redacts sensitive fields**.

## The Constraints

1. Do not block the event loop. Logging must be asynchronous.
2. Handle backpressure. If the disk is slow, do not buffer requests in memory indefinitely.
3. Handle concurrent writes safely. Two requests finishing at the same time must not interleave log lines.
4. **Redact sensitive fields recursively.** If `req.body` contains `{ user: { password: "secret" } }`, the log must show `{ user: { password: "[REDACTED]" } }`.
5. If logging fails, the HTTP response must still be sent.
6. Log **after** the response finishes so the status code is known.

## Skeleton

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'access.log');
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey'];

function redact(obj) {
  // Implement recursive redaction
}

function logRequest(method, url, statusCode, durationMs, body) {
  // Write structured JSON to disk, asynchronously, with redacted body
}

const server = http.createServer((req, res) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req.method, req.url, res.statusCode, duration, req.body);
  });

  // Route logic: parse JSON body, handle /login
  // ...
});

server.listen(3000);
```

## Implementation Guide (Hidden)

<details>
<summary>Click to reveal</summary>

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'access.log');
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey'];

let writeQueue = [];
let isWriting = false;

function redact(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);

  const clone = {};
  for (const [key, value] of Object.entries(obj)) {
    clone[key] = SENSITIVE_FIELDS.some(f => key.toLowerCase().includes(f))
      ? '[REDACTED]'
      : redact(value);
  }
  return clone;
}

function processQueue() {
  if (isWriting || writeQueue.length === 0) return;
  isWriting = true;
  const { line, callback } = writeQueue.shift();

  fs.appendFile(LOG_FILE, line, (err) => {
    isWriting = false;
    callback(err);
    processQueue();
  });
}

function enqueueWrite(line, callback) {
  writeQueue.push({ line, callback });
  processQueue();
}

function logRequest(method, url, statusCode, durationMs, body) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    method,
    url,
    statusCode,
    durationMs,
    body: redact(body),
  }) + '\n';

  enqueueWrite(entry, (err) => {
    if (err) console.error('Logging error:', err.message);
  });
}

const server = http.createServer((req, res) => {
  const start = Date.now();
  let body = '';

  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    const parsedBody = body ? JSON.parse(body) : {};
    req.body = parsedBody;

    res.on('finish', () => {
      const duration = Date.now() - start;
      logRequest(req.method, req.url, res.statusCode, duration, parsedBody);
    });

    if (req.url === '/login' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token: 'fake-jwt' }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
});

server.listen(3000);
```

**Key techniques:**
- **Recursive redaction**: Traverses nested objects and arrays, replacing sensitive keys at any depth.
- **Queue-based mutex**: Guarantees no interleaved writes.
- **Fire-and-forget with error swallowing**: The response is already gone. We cannot retroactively fail it.
- **`res.on('finish')`**: Ensures status code is known and logging does not block the response.

</details>

## Why This Matters

Every framework abstracts logging away. But when your log aggregator bills $0.10 per GB and a single unredacted password triggers a GDPR fine, you need to understand what is underneath. The redaction logic, the write queue, and the timing of the log event are not framework details. They are security and availability boundaries.
