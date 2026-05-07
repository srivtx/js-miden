# M03 Health Check: Impossible Constraints

## The Challenge

Implement a health check server **without** using:

- `async` / `await`
- `Promise`
- `setTimeout` or `setInterval`

You may only use:

- `http.createServer`
- Callbacks
- Synchronous checks (assume `checkDatabaseSync()` and `checkCacheSync()` exist)
- `Date.now()` for timing
- `process.nextTick`

## Why This Is Hard

Modern health checks rely on async I/O to check dependencies without blocking. Without Promises, you must chain callbacks. Without `setTimeout`, you cannot implement a timeout. Without `async/await`, you cannot write linear-looking code.

But there is a deeper challenge: how do you check dependencies in parallel with only callbacks and `process.nextTick`?

## The Constraint Set

| Constraint | Implication |
|------------|-------------|
| No Promises | Manual callback chaining |
| No setTimeout | No built-in timeout mechanism |
| No async/await | Cannot use `try/catch` for async errors |
| Parallel checks | Must track completion state manually |

## Hints (Hidden)

<details>
<summary>Click to reveal</summary>

1. **Parallel checks with callbacks**:
   ```javascript
   let completed = 0;
   const results = {};

   function done(name, result) {
     results[name] = result;
     completed++;
     if (completed === 2) {
       sendResponse();
     }
   }

   checkDatabaseSync((err, result) => done('database', { err, result }));
   checkCacheSync((err, result) => done('cache', { err, result }));
   ```

2. **Simulating timeout without setTimeout**:
   You cannot truly simulate a timeout without `setTimeout`. But you can simulate a *deadline*:
   - Record `Date.now()` at the start.
   - In `process.nextTick`, check if `Date.now() - start > timeout`.
   - If so, mark unchecked dependencies as timed out.
   - This is not a true timeout (it only checks on the next tick), but it demonstrates the concept.

3. **Error handling without try/catch**:
   Callback-based APIs pass errors as the first argument. Always check `if (err)` before using the result.

4. **No async/await means no event loop blocking**:
   Since checks are sync in this hypothetical, they block the event loop. In the real world, this is unacceptable. This constraint forces you to confront why async health checks exist.

</details>

## Skeleton

```javascript
const http = require('http');

function checkDatabaseSync(callback) {
  // Simulated: calls callback(null, { healthy: true, latencyMs: 12 })
  process.nextTick(() => {
    callback(null, { healthy: true, latencyMs: 12 });
  });
}

function checkCacheSync(callback) {
  process.nextTick(() => {
    callback(null, { healthy: true, latencyMs: 3 });
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/health/ready') {
    // Implement parallel checks with callbacks
    // Track completion count
    // Send 200 or 503 when all checks complete
  }
});

server.listen(3000);
```

## The Meta-Challenge

This constraint set is intentionally absurd for a health check server. No real system should block the event loop for dependency checks. But by writing it, you understand:

- Why `Promise.all` exists (to replace manual completion counters).
- Why `setTimeout` exists (to implement true async timeouts).
- Why `async/await` exists (to replace callback pyramids).
- Why synchronous I/O in a server is a bug, not a feature.

You are not building a better health check. You are building an appreciation for the abstractions you already have.

## Why This Is Worth Doing

When you debug a Kubernetes pod that is stuck in `CrashLoopBackOff`, you need to understand the difference between:
- The process exiting because the liveness probe returned 500.
- The process exiting because the readiness probe timed out.
- The process exiting because the startup probe never passed.

These are all callback-driven state machines inside the orchestrator. By writing one yourself, you internalize the model. You stop treating probes as magic endpoints and start treating them as state transitions in a distributed system.
