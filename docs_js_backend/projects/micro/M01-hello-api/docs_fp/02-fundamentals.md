# M01 Hello API: Fundamentals

## Strip the Libraries. Implement from Scratch.

You are not allowed to use `express`, `morgan`, `winston`, `pino`, or any logging middleware. You have:

- Node.js built-in `http`
- Node.js built-in `fs`

Build an HTTP server that logs every request to a file with this exact format:

```
<iso8601-timestamp> <method> <url> <status-code> <duration-ms>\n
```

Example:

```
2024-01-15T09:23:47.123Z GET /users 200 12
2024-01-15T09:23:47.145Z POST /orders 201 45
```

## The Constraints

1. Do not block the event loop. Logging must be asynchronous.
2. Handle backpressure. If the disk is slow, do not buffer requests in memory indefinitely.
3. Handle concurrent writes safely. Two requests finishing at the same time must not interleave log lines.
4. If the log file exceeds 10 MB, rotate it to `access.log.1` and start a new `access.log`.
5. If logging fails, the HTTP response must still be sent.

## Skeleton

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'access.log');
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// You must implement this from scratch.
function logRequest(method, url, statusCode, durationMs) {
  // ...
}

const server = http.createServer((req, res) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req.method, req.url, res.statusCode, duration);
  });

  // Route logic
  if (req.url === '/hello') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello, World!');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(3000, () => {
  console.log('Server listening on port 3000');
});
```

## Implementation Guide (Hidden)

<details>
<summary>Click to reveal</summary>

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'access.log');
const MAX_SIZE = 10 * 1024 * 1024;

// A simple mutex using a queue.
let writeQueue = [];
let isWriting = false;

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

function rotateIfNeeded(callback) {
  fs.stat(LOG_FILE, (err, stats) => {
    if (err || stats.size < MAX_SIZE) {
      return callback();
    }
    fs.rename(LOG_FILE, LOG_FILE + '.1', (err) => {
      // Even if rename fails, we still try to write.
      callback();
    });
  });
}

function logRequest(method, url, statusCode, durationMs) {
  const line = `${new Date().toISOString()} ${method} ${url} ${statusCode} ${durationMs}\n`;

  rotateIfNeeded(() => {
    enqueueWrite(line, (err) => {
      if (err) {
        // Logging failed. We do not crash the server.
        console.error('Logging error:', err.message);
      }
    });
  });
}

const server = http.createServer((req, res) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req.method, req.url, res.statusCode, duration);
  });

  if (req.url === '/hello') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello, World!');
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(3000);
```

**Key techniques:**
- **Queue-based mutex**: Guarantees no interleaved writes without `fs.open` + `fs.write` with file descriptors.
- **Lazy rotation**: Check size only at write time. No background cron needed.
- **Fire-and-forget with error swallowing**: The response is already gone. We cannot retroactively fail it.

</details>

## Why This Matters

Every framework abstracts this away. But when `pino` crashes with `EMFILE` or `morgan` blocks the event loop on a slow NFS mount, you need to know what is underneath. The `fs.appendFile` queue pattern is what every logger does, whether you see it or not.
