# M13 Request Logger: Impossible Constraints

## The Challenge

Implement request logging **without** using:

- `fs.appendFile` or `fs.appendFileSync`
- `fs.createWriteStream`
- Any third-party logging library
- `JSON.stringify` for the log line

You may only use:

- `fs.open`
- `fs.write`
- `fs.close`
- `fs.rename`
- `fs.stat`

And you must still redact sensitive fields recursively.

## Why This Is Hard

`fs.appendFile` handles opening, writing, and closing for you. `fs.createWriteStream` handles buffering, backpressure, and keeping a file descriptor open. `JSON.stringify` handles escaping, nesting, and circular reference safety. Without them, you must implement:

1. **FD lifecycle management**: Open once, write many times, close on shutdown.
2. **Concurrent write serialization**: Two `fs.write` calls on the same FD with the same position will overwrite each other.
3. **Atomic append**: You must pass `position: null` to `fs.write` to append atomically.
4. **Rotation without losing writes**: You cannot close the FD while a write is in flight.
5. **Manual JSON serialization**: Build a string representation of nested objects without `JSON.stringify`, while still redacting sensitive fields.

## The Constraint Set

| Constraint | Implication |
|------------|-------------|
| No appendFile | You manage the FD yourself |
| No streams | You manage buffering and draining yourself |
| No JSON.stringify | You build the log line manually |
| Must handle 1,000 concurrent requests | You need a write queue or a lock |
| Must rotate at 10 MB | You need to close, rename, and reopen atomically |
| Must not lose in-flight writes | Rotation must wait for pending writes |
| Must redact recursively | You traverse and stringify manually |

## Hints (Hidden)

<details>
<summary>Click to reveal</summary>

1. Open the file with `fs.open(LOG_FILE, 'a', callback)`. The `'a'` flag ensures every write appends to the end, regardless of position.

2. Maintain a single FD. Keep it open. Do not open/close per request.

3. Use a queue. Do not call `fs.write` until the previous `fs.write` has called back.

4. For manual JSON serialization:
   ```javascript
   function manualStringify(obj) {
     if (obj === null) return 'null';
     if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;
     if (typeof obj === 'number') return String(obj);
     if (Array.isArray(obj)) return '[' + obj.map(manualStringify).join(',') + ']';
     const pairs = Object.entries(obj).map(([k, v]) => `"${k}":${manualStringify(v)}`);
     return '{' + pairs.join(',') + '}';
   }
   ```

5. For rotation:
   - Stop accepting new log entries.
   - Wait for the queue to drain.
   - Close the FD.
   - Rename the file.
   - Open a new FD.
   - Resume the queue.

6. Handle process signals (`SIGINT`, `SIGTERM`) to close the FD gracefully.

</details>

## Skeleton

```javascript
const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'access.log');
const MAX_SIZE = 10 * 1024 * 1024;
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'authorization', 'apiKey'];

let fd = null;
let writeQueue = [];
let isWriting = false;
let isRotating = false;

function manualStringify(obj) { /* ... */ }
function redact(obj) { /* ... */ }
function openLog(callback) { /* Open with 'a' flag */ }
function processQueue() { /* Dequeue, fs.write(fd, ...), callback, process next */ }
function rotateLog() { /* Set isRotating, wait for drain, close, rename, open, resume */ }
function logRequest(method, url, statusCode, durationMs, body) { /* Enqueue. If size > MAX after this write, trigger rotate. */ }

// Implement the server...
```

## Why This Is Worth Doing

This is exactly what `fs.createWriteStream` and `JSON.stringify` do internally. By rebuilding them, you understand:

- Why `fs.write` with `position: null` is atomic at the kernel level for O_APPEND files.
- Why a write queue is necessary (libuv thread pool + kernel buffers).
- Why graceful shutdown requires draining in-flight work.
- Why `JSON.stringify` is not magic — it is a recursive tree walk with escape logic.

You are not reinventing the wheel. You are inspecting the axle.
