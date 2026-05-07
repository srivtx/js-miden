# M01 Hello API: Three Wrongs

Below are three plausible but broken implementations of request logging. Each looks reasonable on the surface. Each will fail in production.

---

## Wrong #1: Synchronous Logging

```javascript
const fs = require('fs');

function logRequest(method, url, statusCode, durationMs) {
  const line = `${new Date().toISOString()} ${method} ${url} ${statusCode} ${durationMs}\n`;
  fs.appendFileSync('access.log', line);
}
```

### Why It Looks Right
It is simple. No callbacks. No queues. The line is on disk before the function returns.

### Why It Destroys You
`appendFileSync` blocks the event loop. On a busy server with 1,000 req/s, each write might take 2 ms. That is 2 seconds of blocked event loop per second of wall time. Latency spikes to seconds. Throughput collapses to single-digit RPS.

**The failure mode**: Under load, the server becomes unresponsive. Health checks time out. The orchestrator kills the pod. The new pod also dies. You are in a crash loop.

---

## Wrong #2: Fire-and-Forget Async with No Backpressure

```javascript
const fs = require('fs');

function logRequest(method, url, statusCode, durationMs) {
  const line = `${new Date().toISOString()} ${method} ${url} ${statusCode} ${durationMs}\n`;
  fs.appendFile('access.log', line, (err) => {
    if (err) console.error(err);
  });
}
```

### Why It Looks Right
It is non-blocking. It uses the Node.js callback pattern. It handles errors.

### Why It Destroys You
`fs.appendFile` opens the file, writes, and closes it — every single time. At high concurrency, the kernel file descriptor table explodes. Worse, if the disk is slow, the internal libuv write queue grows without bound. You are buffering an infinite number of strings in memory. The process OOMs.

**The failure mode**: Memory usage grows linearly with traffic. The pod is OOM-killed. There is no visible error until the kill.

---

## Wrong #3: Shared Stream with No Rotation

```javascript
const fs = require('fs');
const stream = fs.createWriteStream('access.log', { flags: 'a' });

function logRequest(method, url, statusCode, durationMs) {
  const line = `${new Date().toISOString()} ${method} ${url} ${statusCode} ${durationMs}\n`;
  stream.write(line);
}
```

### Why It Looks Right
A single stream avoids the open/close overhead. `stream.write` is async and backpressured. This is how real loggers work.

### Why It Destroys You
There is no rotation. The file grows forever. On a long-running server, the disk fills. But the subtler bug is that `stream.write` can return `false` when the buffer is full, and this code ignores it. Under sustained load, the internal stream buffer grows until the process OOMs.

**The failure mode**: Disk fills after 3 weeks of uptime. Or, under a traffic spike, the stream buffer balloons and the process OOMs in minutes.

---

## The Pattern

| Wrong | Surface Appeal | Hidden Failure |
|-------|---------------|----------------|
| Synchronous | Simplicity, durability | Event loop blocking, throughput death |
| Fire-and-forget async | Non-blocking, idiomatic | FD exhaustion, unbounded memory growth |
| Shared stream | Efficient, backpressured | No rotation, ignored backpressure signal |

The correct solution requires combining the best of all three: async writes, a single stream or queue for efficiency, rotation for disk safety, and explicit backpressure handling.
