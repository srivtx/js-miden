# Deep Dive: Express.js Internals, Architecture & Best Practices

**Research Date:** May 2026  
**Node.js Versions Referenced:** 18.x - 25.x  
**Express Versions:** 4.22.x (LTS), 5.2.x (Latest)  

---

## Table of Contents

1. [How Express.js Works Internally](#1-how-expressjs-works-internally)
2. [Node.js Event Loop Interaction with Express](#2-nodejs-event-loop-interaction-with-express)
3. [Why Express Uses Middleware vs Other Patterns](#3-why-express-uses-middleware-vs-other-patterns)
4. [Performance Characteristics: Express vs Fastify vs Koa vs NestJS](#4-performance-characteristics)
5. [Memory Management in Long-Running Express Processes](#5-memory-management-in-long-running-express-processes)
6. [Latest Express 5.x Changes and Why They Matter](#6-latest-express-5x-changes-and-why-they-matter)
7. [Common Anti-Patterns and What Happens If You Do Them Wrong](#7-common-anti-patterns-and-what-happens-if-you-do-them-wrong)

---

## 1. How Express.js Works Internally

### 1.1 The Application Shell

At its core, Express is a thin abstraction over Node.js's built-in `http` module. When you call `express()`, you create an instance of an `Application` object (defined in `lib/application.js`). This object is itself a function with properties attached, making it callable as `app(req, res)` while also supporting methods like `app.use()`, `app.get()`, etc.

```javascript
// lib/express.js - Simplified core
function createApplication() {
  var app = function(req, res, next) {
    app.handle(req, res, next);
  };
  
  mixin(app, EventEmitter.prototype, false);
  mixin(app, proto, false);
  
  app.request = Object.create(req, {
    app: { configurable: true, enumerable: true, writable: true, value: app }
  });
  
  app.response = Object.create(res, {
    app: { configurable: true, enumerable: true, writable: true, value: app }
  });
  
  app.init();
  return app;
}
```

**Key Design Philosophy:** Express "augments Node" rather than replacing it. It wraps Node's `req` and `res` objects with additional properties and methods but keeps the underlying stream-based architecture intact.

### 1.2 The Middleware Pipeline (The "Stack")

Express maintains an internal array called the `stack` (in Express 5, managed by the external `router` package). Each middleware or route handler is wrapped in a `Layer` object containing:

- **route**: The path string, RegExp, or array
- **handle**: The actual middleware function
- **name**: The function name (for debugging)
- **regexp**: A compiled path-to-regexp pattern for matching
- **keys**: Parameter names extracted from the path

```javascript
// Conceptual Layer structure
{
  handle: [Function: myMiddleware],
  name: 'myMiddleware',
  params: undefined,
  path: undefined,
  keys: [],
  regexp: /^\/user\/(?:([^\/]+?))\/?$/i,
  route: { path: '/user/:id', stack: [...] }
}
```

When a request arrives, Express iterates through this stack synchronously. For each layer:

1. **Path Matching**: The `regexp.test()` determines if the layer's path matches `req.path`
2. **Method Matching** (for routes): Checks if `req.method` matches the route method
3. **Execution**: Calls `layer.handle_request(req, res, next)`
4. **Next Invocation**: If the middleware calls `next()`, control moves to the next matching layer

**Critical Implementation Detail:** The `next()` function is not a simple array iterator. It's a closure that maintains internal state about:
- The current index in the stack
- Whether the response has been sent
- Error state (`next(err)` skips to error-handling middleware)

```javascript
// Simplified next() logic
function next(err) {
  var layer;
  var match;
  var route;
  
  while (match !== true && idx < stack.length) {
    layer = stack[idx++];
    match = matchLayer(layer, path);
    route = layer.route;
    
    if (match !== true) continue;
    
    if (!route) continue;  // Skip non-route layers that don't match
    
    if (route && route.methods && !route.methods[method]) {
      match = false;  // Method doesn't match
    }
  }
  
  if (!match) {
    return done(layerError);  // 404 or pass to parent router
  }
  
  // Execute the matched layer
  if (err) {
    layer.handle_error(err, req, res, next);
  } else {
    layer.handle_request(req, res, next);
  }
}
```

### 1.3 The Request/Response Cycle

**Phase 1: Connection Acceptance**
Node's `http.Server` emits a `'request'` event. Express's `app` function is the listener:

```javascript
// In app.listen(), Node does:
http.createServer(app).listen(port);
```

**Phase 2: Request Augmentation**
Express wraps the raw Node `IncomingMessage` and `ServerResponse`:
- `req` gains properties: `req.params`, `req.query`, `req.body` (after body-parser), `req.cookies`
- `res` gains methods: `res.send()`, `res.json()`, `res.render()`, `res.status()`

**Phase 3: Stack Traversal**
The router iterates through the stack. For each matching layer:
- Route parameters are extracted via `regexp.exec(path)` and assigned to `req.params`
- The middleware function executes
- If it calls `next()`, the loop continues
- If it calls `res.send()` or similar, the response terminates the cycle

**Phase 4: Response Finalization**
If no middleware sends a response and the stack is exhausted, Express sends a default 404. In Express 5, `finalhandler` manages the final response formatting.

### 1.4 Router Mechanism Deep Dive

Express's router (extracted to the `router` package in v5) uses `path-to-regexp` for path matching.

**In Express 4:**
```javascript
// path-to-regexp v0.1.x
app.get('/user/:id', handler);
// Compiles to: /^\/user\/(?:([^\/]+?))\/?$/i
```

**In Express 5:**
```javascript
// path-to-regexp v4.x (major rewrite)
app.get('/user/:id', handler);
// Wildcards require names: app.get('/*splat', handler)
// Optional params use braces: app.get('/:file{.:ext}', handler)
```

**Router Nesting & `mergeParams`:**
When you mount a Router with `app.use('/api', apiRouter)`, the child router sees only the path *after* `/api`. To access parent params:

```javascript
const router = express.Router({ mergeParams: true });
// Now router can access req.params from parent routes
```

**Consequence of NOT Understanding This:**
- Mounting order matters. `app.use('/user', auth)` before `app.get('/user/public', handler)` will apply auth to the public route too if path matching is broad.
- Without `mergeParams: true`, nested routers can't access URL parameters defined in parent routes, causing `req.params` to be empty.

### 1.5 Error Handling Pipeline

Error-handling middleware is distinguished by having **four parameters** instead of three:

```javascript
app.use((err, req, res, next) => {
  // This ONLY runs if previous middleware called next(err)
  res.status(500).json({ error: err.message });
});
```

**In Express 5:** If an async middleware throws or rejects, the error is automatically caught and passed to `next(err)`:

```javascript
// Express 5 - Automatically handled
app.get('/', async (req, res) => {
  const data = await db.query();  // If this rejects, next(err) is called
  res.json(data);
});
```

---

## 2. Node.js Event Loop Interaction with Express

### 2.1 How Express Lives on the Event Loop

Express itself is entirely synchronous. The framework code that matches routes, executes middleware, and prepares responses runs on the **poll phase** of the Node.js event loop. However, the I/O operations *inside* your middleware (database queries, file reads, HTTP requests) delegate to libuv's thread pool and return via callbacks.

**The Event Loop Phases (Relevant to Express):**

```
   ┌───────────────────────────┐
   │           timers          │  ← setTimeout/setInterval callbacks
   └─────────────┬─────────────┘
                 │
   ┌─────────────┴─────────────┐
   │     pending callbacks     │  ← TCP errors (ECONNREFUSED, etc.)
   └─────────────┬─────────────┘
                 │
   ┌─────────────┴─────────────┐
   │           poll            │  ← I/O callbacks, HTTP requests
   │  (Express executes here)  │
   └─────────────┬─────────────┘
                 │
   ┌─────────────┴─────────────┐
   │           check           │  ← setImmediate() callbacks
   └───────────────────────────┘
```

### 2.2 The Request Lifecycle on the Event Loop

When an HTTP connection arrives:

1. **Kernel** accepts the TCP connection and notifies libuv
2. **Poll Phase**: Node's `http` module receives the `'request'` event
3. **Express Stack Execution**: The entire middleware chain runs synchronously *unless* a middleware performs async I/O
4. **Async Delegation**: If middleware calls `fs.readFile()` or `db.query()`, the callback is scheduled
5. **Response Completion**: If all middleware are sync, the response headers are flushed in the same poll phase tick

**Critical Insight:** A single request does not "span" multiple event loop ticks if your middleware is purely synchronous. The entire req→res cycle happens in one tick. However, if you perform async I/O, the tick ends, your callback is scheduled, and when it fires (likely in another poll phase), execution resumes.

### 2.3 Blocking the Event Loop in Express

**The #1 Performance Killer:**

```javascript
// ANTI-PATTERN: Blocking the event loop
app.get('/report', (req, res) => {
  const data = fs.readFileSync('./huge-file.csv');  // Blocks for 500ms
  const parsed = heavyCpuParser(data);               // Blocks for 2s
  res.json(parsed);
});
```

**Consequence:** During those 2.5 seconds:
- No other requests are processed
- TCP connections queue up in the kernel
- Timeouts fire unexpectedly
- Memory pressure increases from queued connections

**Node.js 20+ Change:** Starting with libuv 1.45.0 (Node.js 20), timers run ONLY after the poll phase (not before AND after as in earlier versions). This affects the timing of `setImmediate()` callbacks relative to I/O completion.

### 2.4 process.nextTick() in Express Context

`process.nextTick()` fires immediately after the current operation completes, before the event loop continues. Express uses this internally for certain operations, and you can too:

```javascript
// Ensures cleanup happens before next middleware/event loop phase
app.use((req, res, next) => {
  res.on('finish', () => {
    process.nextTick(() => {
      // Clean up resources immediately after response sent
      req.dbConnection.release();
    });
  });
  next();
});
```

**Danger:** Recursive `nextTick()` calls can starve I/O. Never do:

```javascript
// NEVER DO THIS
function recursiveNextTick() {
  process.nextTick(recursiveNextTick);
}
```

### 2.5 Best Practices for Event Loop Health (2024-2025)

1. **Use `--trace-sync-io`** in development to catch sync I/O:
   ```bash
   node --trace-sync-io server.js
   ```

2. **Monitor Event Loop Lag:**
   ```javascript
   const lagMonitor = require('event-loop-lag')(1000);
   app.use((req, res, next) => {
     req.eventLoopLag = lagMonitor();
     next();
   });
   ```

3. **Offload CPU work to Worker Threads:**
   ```javascript
   const { Worker } = require('worker_threads');
   app.post('/process', async (req, res) => {
     const worker = new Worker('./cpu-worker.js');
     worker.postMessage(req.body);
     worker.once('message', result => res.json(result));
   });
   ```

4. **Use `setImmediate` over `process.nextTick`** for deferring work, as recommended by Node.js core team.

---

## 3. Why Express Uses Middleware Pattern vs Other Patterns

### 3.1 The Middleware Pattern: Technical Definition

Express middleware is a **pipeline of functions** that transform a request into a response. Each function has the signature:

```javascript
function middleware(req, res, next) {
  // Operate on req/res
  // Optionally call next() to continue
  // Optionally call next(err) to abort with error
  // Optionally send response to end cycle
}
```

**Key Properties:**
- **Order-dependent**: Middleware execute in registration order
- **Mutable context**: `req` and `res` are shared, mutable objects
- **Short-circuit capable**: Any middleware can terminate the pipeline
- **Error isolation**: Errors bubble to dedicated error handlers

### 3.2 Comparison: Django (Python)

**Django's "Onion" Middleware:**

```python
# Django middleware is a wrapper around the view
def simple_middleware(get_response):
    def middleware(request):
        # Pre-view logic
        response = get_response(request)  # Calls view
        # Post-view logic
        return response
    return middleware
```

**Key Differences:**

| Aspect | Express | Django |
|--------|---------|--------|
| Pattern | Linear pipeline | Onion/layered wrapper |
| State sharing | Mutable `req`/`res` objects | Immutable `request` object |
| Error handling | `next(err)` bubbles | Automatic exception conversion |
| Async model | Callbacks/Promises (Node) | Sync by default, async optional |
| Routing | Integrated in app | Separate URL dispatcher |
| Middleware type | Functions/classes | Factory functions/classes |

**Why Express doesn't use Django's model:**
- Node.js's single-threaded event loop favors the linear callback model
- Mutable `req`/`res` allows incremental building of response state
- JavaScript's closure model makes the pipeline pattern natural

**Consequence of Django's model in Node:** Would require significant overhead for sync/async adaptation, reducing throughput.

### 3.3 Comparison: FastAPI (Python)

**FastAPI's Dependency Injection Pattern:**

```python
from fastapi import FastAPI, Depends

app = FastAPI()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/items/")
async def read_items(db: Session = Depends(get_db)):
    return db.query(Item).all()
```

**Key Differences:**

| Aspect | Express | FastAPI |
|--------|---------|---------|
| Pattern | Middleware pipeline | Dependency injection + path operations |
| Validation | Manual or external libs | Automatic via Pydantic types |
| Async model | Callbacks/Promises | Native `async/await` (Python) |
| Documentation | Manual (Swagger-UI, etc.) | Auto-generated OpenAPI |
| Serialization | Manual | Automatic via response models |

**Why Express doesn't use FastAPI's model:**
- Express predates modern Python typing (launched 2010 vs FastAPI 2018)
- JavaScript's dynamic typing makes compile-time validation impossible without external tools (TypeScript)
- FastAPI's DI container adds overhead that would conflict with Node's lightweight philosophy

### 3.4 Comparison: Spring Boot (Java)

**Spring Boot's Filter/Servlet/Interceptor Model:**

```java
@Component
public class LoggingFilter implements Filter {
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain) {
        // Pre-processing
        chain.doFilter(req, res);  // Continue chain
        // Post-processing
    }
}
```

**Key Differences:**

| Aspect | Express | Spring Boot |
|--------|---------|-------------|
| Pattern | Functional pipeline | Object-oriented chain of responsibility |
| Container | None (process-per-instance) | Servlet container (Tomcat/Jetty) |
| Lifecycle | Manual | Managed by IoC container |
| Threading | Single-threaded event loop | Multi-threaded (thread-per-request) |
| Memory model | Shared nothing within request | Thread-local state |

**Why Express doesn't use Spring's model:**
- Thread-per-request models don't scale on Node's single-threaded architecture
- Spring's heavy IoC container would add milliseconds to startup time
- JavaScript's prototype-based OOP makes class-heavy patterns unnatural

### 3.5 Why Express Chose Middleware (Design Philosophy)

1. **Minimalism**: "Augment Node, don't replace it"
2. **Flexibility**: No enforced structure - developers compose their own architecture
3. **Performance**: Zero overhead from DI containers or reflection
4. **Ecosystem**: Easy to publish and consume middleware via npm
5. **JavaScript Idiomatic**: Closures and callbacks are native JS patterns

**Consequence of NOT Using Middleware:**
Without middleware, every route handler would need to manually implement cross-cutting concerns (logging, auth, body parsing, CORS). This leads to:
- Massive code duplication
- Inconsistent security implementations
- Tight coupling between business logic and infrastructure

---

## 4. Performance Characteristics

### 4.1 Hello World Benchmarks (Framework Overhead)

Data from [Fastify Official Benchmarks](https://fastify.dev/benchmarks/) (January 2026):

| Framework | Requests/sec | Relative to Fastify |
|-----------|-------------|---------------------|
| **Fastify** | 46,664 | 100% (baseline) |
| H3 | 43,674 | 93.6% |
| Hono | 36,694 | 78.7% |
| **Koa** | 35,086 | 75.2% |
| Restify | 34,347 | 73.6% |
| Hapi | 32,030 | 68.7% |
| **Express** | 9,433 | 20.2% |

**Important Caveat:** These are synthetic "Hello World" benchmarks measuring pure framework overhead. Real-world performance depends heavily on:
- JSON parsing/serialization
- Database query patterns
- Middleware stack depth
- Response payload size

### 4.2 Why Express is Slower

**1. Middleware Stack Traversal:**
Express iterates a JavaScript array for every request, performing regex matching on each layer. Fastify uses a [radix tree](https://en.wikipedia.org/wiki/Radix_tree) (prefix tree) for O(1) route lookups.

**2. Object Augmentation:**
Express wraps Node's `req`/`res` with prototype chains:
```javascript
// Express wraps objects
req.__proto__ = app.request;
res.__proto__ = app.response;
```
Fastify creates lightweight request/response objects from scratch.

**3. JSON Serialization:**
Fastify uses `fast-json-stringify` with pre-compiled schemas. Express uses `JSON.stringify()` dynamically.

**4. Hook System:**
Fastify's lifecycle hooks (onRequest, preParsing, preHandler, etc.) are optimized for specific phases. Express's generic middleware stack is less optimized.

### 4.3 When Express Performance is "Good Enough"

- **I/O-bound applications**: If your app spends 90% of time waiting for databases, framework overhead is negligible
- **Microservices**: Small surface area = shallow middleware stack
- **Developer velocity**: If team knows Express well, switching costs may exceed performance gains
- **Horizontal scaling**: Express behind a load balancer can handle massive traffic with multiple instances

### 4.4 Koa Performance Profile

Koa is ~3.7x faster than Express in raw benchmarks because:
- No bundled middleware (router, body parser not included)
- Uses async/await natively (eliminates callback overhead)
- Context object (`ctx`) is lighter than Express's dual `req`/`res` augmentation

However, adding `koa-router` and `koa-bodyparser` brings it closer to Express performance.

### 4.5 NestJS Performance Profile

NestJS is built ON TOP of Express (or Fastify) by default. Its overhead comes from:
- Dependency injection container resolution
- Decorator metadata reflection
- Module system indirection

**Benchmarks:** NestJS with Express adapter is roughly equivalent to Express. NestJS with Fastify adapter achieves ~90% of raw Fastify performance.

### 4.6 Realistic Performance Tuning for Express (2024-2025)

```javascript
// 1. Always set NODE_ENV=production
// This alone improves performance by ~3x according to Dynatrace tests
process.env.NODE_ENV = 'production';

// 2. Use reverse proxy for static files and compression
// Nginx/HAProxy handles TLS termination, gzip, and static serving

// 3. Enable clustering
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isPrimary) {
  for (let i = 0; i < numCPUs; i++) cluster.fork();
} else {
  app.listen(3000);
}

// 4. Use efficient JSON serialization for large payloads
const fastJson = require('fast-json-stringify');
const stringify = fastJson({
  type: 'object',
  properties: { name: { type: 'string' }, count: { type: 'integer' } }
});

// 5. Connection pooling for databases
const pool = new pg.Pool({ max: 20 });

// 6. Use streaming for large responses
app.get('/stream', (req, res) => {
  const stream = db.query('SELECT * FROM large_table');
  stream.pipe(res);
});
```

---

## 5. Memory Management in Long-Running Express Processes

### 5.1 V8 Memory Architecture

Node.js runs on V8, which organizes memory into:

- **New Space** (Young Generation): Small, frequently GC'd (Scavenge algorithm)
- **Old Space** (Old Generation): Larger, infrequently GC'd (Mark-Sweep-Compact)
- **Code Space**: JIT-compiled code
- **Large Object Space**: Objects > 128KB

**Express-Specific Memory Considerations:**

### 5.2 Common Memory Leaks in Express

**Leak #1: Closure Captures in Event Listeners**

```javascript
// LEAK: Event listener captures req, preventing GC
app.get('/stream', (req, res) => {
  const stream = getDataStream();
  stream.on('data', chunk => res.write(chunk));
  stream.on('end', () => res.end());
  // Missing: stream.removeAllListeners() or proper cleanup
});

// FIX: Clean up on response finish
app.get('/stream', (req, res) => {
  const stream = getDataStream();
  const onData = chunk => res.write(chunk);
  const onEnd = () => res.end();
  
  stream.on('data', onData);
  stream.on('end', onEnd);
  
  res.on('finish', () => {
    stream.removeListener('data', onData);
    stream.removeListener('end', onEnd);
    stream.destroy();
  });
});
```

**Leak #2: Global Caches Without Bounds**

```javascript
// LEAK: Unbounded cache
const cache = new Map();
app.get('/user/:id', async (req, res) => {
  if (cache.has(req.params.id)) {
    return res.json(cache.get(req.params.id));
  }
  const user = await db.getUser(req.params.id);
  cache.set(req.params.id, user);  // Grows forever!
  res.json(user);
});

// FIX: LRU cache with size limit
const LRU = require('lru-cache');
const cache = new LRU({ max: 1000, ttl: 1000 * 60 * 5 });
```

**Leak #3: Timers and Intervals**

```javascript
// LEAK: setInterval keeps callback alive
app.get('/poll', (req, res) => {
  const interval = setInterval(() => {
    checkStatus().then(status => {
      if (status.ready) {
        res.json(status);
        // Missing: clearInterval(interval)
      }
    });
  }, 1000);
});

// FIX: Always clear timers
const interval = setInterval(() => { /* ... */ }, 1000);
req.on('close', () => clearInterval(interval));
res.on('finish', () => clearInterval(interval));
```

**Leak #4: Promise Chains Without Cleanup**

```javascript
// LEAK: Promise holds reference to res even if client disconnects
app.get('/slow', (req, res) => {
  slowOperation().then(result => {
    // If client disconnected, res is still held in memory
    res.json(result);
  });
});

// FIX: Check if response is finished
app.get('/slow', (req, res) => {
  slowOperation().then(result => {
    if (!res.writableEnded) {
      res.json(result);
    }
  });
});
```

### 5.3 Memory Profiling Tools

```bash
# Generate heap snapshot
node --heap-prof server.js

# Enable GC tracing
node --trace-gc server.js

# Use --inspect for Chrome DevTools
node --inspect server.js
# Then open chrome://inspect
```

**Using `heapdump` or built-in v8 module:**
```javascript
const v8 = require('v8');
const fs = require('fs');

app.get('/debug/heap', (req, res) => {
  const snapshot = v8.writeHeapSnapshot();
  res.download(snapshot);
});
```

### 5.4 Best Practices for Long-Running Processes

1. **Set memory limits:**
   ```bash
   node --max-old-space-size=4096 server.js
   ```

2. **Use connection pooling** (databases, HTTP agents)

3. **Monitor with Prometheus/Heapster:**
   ```javascript
   const client = require('prom-client');
   const memoryGauge = new client.Gauge({
     name: 'nodejs_heap_size_used_bytes',
     help: 'Used heap size in bytes'
   });
   
   setInterval(() => {
     memoryGauge.set(process.memoryUsage().heapUsed);
   }, 10000);
   ```

4. **Graceful restart on memory threshold:**
   ```javascript
   setInterval(() => {
     const used = process.memoryUsage().heapUsed / 1024 / 1024;
     if (used > 1024) {  // 1GB threshold
       console.error('Memory limit exceeded, graceful shutdown...');
       server.close(() => process.exit(1));
     }
   }, 30000);
   ```

5. **Use `weak-napi` or `WeakRef` for caches:**
   ```javascript
   const cache = new Map();
   const ref = new WeakRef(largeObject);
   // largeObject can be GC'd when no other references exist
   ```

---

## 6. Latest Express 5.x Changes and Why They Matter

**Current Version:** 5.2.1 (December 2025)  
**Minimum Node.js:** 18.x  
**Status:** Production-ready (released Oct 2024)

### 6.1 Native Promise/Async Support

**What Changed:**
In Express 5, middleware and route handlers that return Promises (including `async` functions) automatically have their rejections caught and forwarded to error-handling middleware.

```javascript
// Express 5 - This works without try/catch
app.get('/users', async (req, res) => {
  const users = await db.getUsers();  // If rejects, next(err) called automatically
  res.json(users);
});
```

**Why It Matters:**
- Eliminates the need for `express-async-handler` wrapper packages
- Prevents unhandled promise rejections that crash the process
- Aligns with modern JavaScript async/await patterns

**Consequence of Not Using It:**
In Express 4, an unhandled rejection in async middleware crashes the process or leaves the request hanging:
```javascript
// Express 4 - DANGEROUS
app.get('/users', async (req, res) => {
  const users = await db.getUsers();  // Rejection = unhandled, process crash!
  res.json(users);
});
```

### 6.2 Path Route Matching Syntax Overhaul

Express 5 upgrades from `path-to-regexp` v0.1 to v4.x. This is a complete rewrite.

**Breaking Changes:**

| Express 4 | Express 5 |
|-----------|-----------|
| `app.get('/*', handler)` | `app.get('/*splat', handler)` |
| `app.get('/:file.:ext?', handler)` | `app.get('/:file{.:ext}', handler)` |
| `app.get('/[discussion\|page]/:slug')` | `app.get(['/discussion/:slug', '/page/:slug'])` |
| RegExp paths supported | RegExp paths **removed** |
| `?`, `+`, `*` in paths | Must escape with `\` or use braces |

**Why It Matters:**
- More consistent, predictable routing
- Better security (RegExp routes were a ReDoS vector)
- Named wildcards improve parameter handling

**Consequence of Not Migrating:**
Routes will silently fail to match or throw errors at runtime. The `*splat` change is particularly dangerous:
```javascript
// Express 4 route that breaks in 5
app.get('/*', (req, res) => res.send('catch-all'));
// Express 5: Throws error - wildcards must be named
```

### 6.3 Wildcard Parameters Are Now Arrays

```javascript
// Express 5
app.get('/*splat', (req, res) => {
  // GET /foo/bar
  console.log(req.params);
  // => [Object: null prototype] { splat: [ 'foo', 'bar' ] }
});
```

In Express 4, wildcards were strings (`'foo/bar'`). This change affects any code doing string operations on wildcard params.

### 6.4 `req.body` Returns `undefined` Instead of `{}`

```javascript
// Express 4
app.post('/data', (req, res) => {
  console.log(req.body);  // => {} (even if no body parser)
});

// Express 5
app.post('/data', (req, res) => {
  console.log(req.body);  // => undefined
});
```

**Why It Matters:** Code doing `if (req.body.key)` will behave differently. Must use `if (req.body?.key)`.

### 6.5 Removed Deprecated Methods

- `app.del()` → Use `app.delete()`
- `req.param(name)` → Use `req.params`, `req.body`, or `req.query` explicitly
- `res.send(obj, status)` → Use `res.status(status).send(obj)`
- `res.json(obj, status)` → Use `res.status(status).json(obj)`
- `res.redirect(url, status)` → Use `res.redirect(status, url)` (args swapped)
- `res.sendfile()` → Use `res.sendFile()` (camelCase)
- `res.redirect('back')` → Use `res.redirect(req.get('Referrer') || '/')`
- `res.send(status)` → Use `res.sendStatus(status)`

### 6.6 Brotli Encoding Support

Express 5 adds native Brotli compression support (in addition to gzip/deflate). This reduces response sizes by 15-25% compared to gzip.

```javascript
const compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  // Brotli is used automatically when client supports it
}));
```

### 6.7 `express.static` dotfiles Default Changed

In Express 5, `express.static` defaults to `dotfiles: 'ignore'` (was `'allow'` in v4). This means `.well-known` directories return 404 by default.

```javascript
// Fix for ACME/.well-known
app.use('/.well-known', express.static('public/.well-known', { dotfiles: 'allow' }));
app.use(express.static('public'));
```

### 6.8 `app.listen()` Error Handling

```javascript
// Express 5 - Errors passed to callback
const server = app.listen(8080, '0.0.0.0', (error) => {
  if (error) throw error;  // e.g., EADDRINUSE
  console.log('Listening');
});
```

### 6.9 Why Upgrade to Express 5?

| Benefit | Impact |
|---------|--------|
| Native async/await | Eliminates wrapper libraries, reduces bugs |
| Modern path-to-regexp | Better security, consistency |
| Brotli support | Reduced bandwidth |
| Modernized API | Aligns with current JavaScript conventions |
| Active development | Express 4 is maintenance mode only |

**Migration Tool:**
```bash
npx codemod@latest @expressjs/v5-migration-recipe
```

---

## 7. Common Anti-Patterns and What Happens If You Do Them Wrong

### 7.1 Anti-Pattern: Not Calling `next()` or Sending a Response

```javascript
// WRONG: Request hangs until timeout
app.use((req, res, next) => {
  console.log('Logging...');
  // Forgot next() or res.send()
});

// WRONG in Express 4: Async without error handling
app.get('/data', async (req, res) => {
  const data = await db.query();  // If this throws, request hangs forever
  res.json(data);
});
```

**Consequence:** Client waits until TCP timeout (usually 30-120s). Server leaks memory from hung request contexts. In high traffic, this exhausts connection pools and crashes the process.

**Fix:**
```javascript
// Always end the request or call next
app.use((req, res, next) => {
  console.log('Logging...');
  next();
});

// In Express 5, async errors are caught automatically
// In Express 4, use a wrapper:
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
app.get('/data', asyncHandler(async (req, res) => {
  const data = await db.query();
  res.json(data);
}));
```

### 7.2 Anti-Pattern: Synchronous I/O in Request Handlers

```javascript
// WRONG: Blocks event loop
app.get('/file', (req, res) => {
  const content = fs.readFileSync('./large-file.pdf');
  res.send(content);
});
```

**Consequence:** As discussed in Section 2, this blocks ALL requests for the duration of the read. A 100MB file read could take 500ms+ on slow disks, during which zero other requests are processed.

**Fix:**
```javascript
// Use streams for large files
app.get('/file', (req, res) => {
  const stream = fs.createReadStream('./large-file.pdf');
  stream.pipe(res);
});

// Or async/await for small files
app.get('/config', async (req, res) => {
  const content = await fs.promises.readFile('./config.json', 'utf8');
  res.json(JSON.parse(content));
});
```

### 7.3 Anti-Pattern: Trusting `req.body` Without Validation

```javascript
// WRONG: NoSQL injection vulnerability
app.post('/users', async (req, res) => {
  await db.collection('users').findOne({ email: req.body.email });
  // Attacker sends: { "email": { "$ne": null } }
});
```

**Consequence:** NoSQL injection, prototype pollution, or application crashes from unexpected types.

**Fix:**
```javascript
// Use express-validator or zod
const { body, validationResult } = require('express-validator');

app.post('/users',
  body('email').isEmail().normalizeEmail(),
  body('age').isInt({ min: 0, max: 150 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Safe to use req.body.email and req.body.age
  }
);
```

### 7.4 Anti-Pattern: Storing State in the Process

```javascript
// WRONG: Breaks clustering, causes memory leaks
const sessions = {};
app.post('/login', (req, res) => {
  sessions[req.body.userId] = { loggedIn: true, data: req.body };
  res.send('OK');
});
```

**Consequence:**
- Cannot scale horizontally (requests go to different processes)
- Memory grows unbounded as sessions accumulate
- Process restart = all sessions lost

**Fix:**
```javascript
// Use Redis or external session store
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, httpOnly: true, maxAge: 3600000 }
}));
```

### 7.5 Anti-Pattern: Using `console.log()` in Production

```javascript
// WRONG: console.log is synchronous in Node
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);  // Blocks event loop!
  next();
});
```

**Consequence:** `console.log` to stdout/stderr is synchronous. Under high load, logging becomes a bottleneck. Each log statement blocks until written to the file descriptor.

**Fix:**
```javascript
// Use Pino - fastest JSON logger
const pino = require('pino');
const logger = pino({ level: 'info' });

app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url });
  next();
});

// Or use async transports
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});
```

### 7.6 Anti-Pattern: Not Handling `uncaughtException`

```javascript
// WRONG: Ignoring process-level errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Process continues in corrupted state!
});
```

**Consequence:** After an uncaught exception, the process is in an **undefined state**. Continuing to run risks data corruption, security vulnerabilities, and unpredictable crashes.

**Fix:**
```javascript
// Log and exit immediately
process.on('uncaughtException', (err) => {
  logger.fatal(err, 'Uncaught exception');
  process.exit(1);
});

// Use domain-less error propagation in Express 5
app.use((err, req, res, next) => {
  logger.error(err, 'Request error');
  res.status(err.status || 500).json({ error: 'Internal error' });
});
```

### 7.7 Anti-Pattern: Exposing Stack Traces in Production

```javascript
// WRONG: Information disclosure
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message, stack: err.stack });
});
```

**Consequence:** Attackers gain knowledge of your file structure, dependencies, and potential vulnerabilities.

**Fix:**
```javascript
app.use((err, req, res, next) => {
  logger.error(err);
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});
```

### 7.8 Anti-Pattern: No Request Timeout Handling

```javascript
// WRONG: Requests can hang indefinitely
app.get('/slow', async (req, res) => {
  const data = await thirdPartyApi.call();  // No timeout!
  res.json(data);
});
```

**Consequence:** If the third party is down, requests accumulate, exhausting memory and connection limits.

**Fix:**
```javascript
const axios = require('axios');

app.get('/slow', async (req, res) => {
  try {
    const { data } = await axios.get('https://api.example.com', {
      timeout: 5000,  // 5 second timeout
      signal: AbortSignal.timeout(5000)  // Node 18+
    });
    res.json(data);
  } catch (err) {
    res.status(504).json({ error: 'Upstream timeout' });
  }
});
```

### 7.9 Anti-Pattern: Missing Security Headers

```javascript
// WRONG: Default Express has minimal security
const app = express();
app.use(express.json());
// No helmet, no CORS config, no rate limiting
```

**Consequence:** XSS, CSRF, clickjacking, MIME-type sniffing, and other web vulnerabilities.

**Fix (2024-2025 Security Baseline):**
```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS (configured, not wide open)
const cors = require('cors');
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true
}));
```

### 7.10 Anti-Pattern: No Graceful Shutdown

```javascript
// WRONG: Process kill drops in-flight requests
process.on('SIGTERM', () => {
  process.exit(0);
});
```

**Consequence:** During deployments, active requests are terminated mid-flight, causing 502/503 errors for clients.

**Fix:**
```javascript
const server = app.listen(port);

function gracefulShutdown(signal) {
  console.log(`${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed');
    // Close database connections
    db.end().then(() => {
      console.log('Database connections closed');
      process.exit(0);
    });
  });
  
  // Force shutdown after 30s
  setTimeout(() => {
    console.error('Forced shutdown');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

## Appendix: Key Takeaways

1. **Express is a thin wrapper** over Node's `http` module, using a linear middleware pipeline
2. **The event loop matters** - avoid synchronous I/O and CPU-intensive operations in request handlers
3. **Middleware is the right pattern for Node.js** because it matches the language's callback-oriented, single-threaded model
4. **Express is slower than alternatives** in raw benchmarks but often "fast enough" for I/O-bound apps
5. **Memory leaks come from closures, caches, and timers** - always clean up resources on `res` events
6. **Express 5 brings modern async support** and security improvements - upgrade is recommended
7. **Anti-patterns have real consequences** - hanging requests, memory leaks, security vulnerabilities, and crashes

---

*Sources: Express.js Official Documentation, Node.js Documentation, Fastify Benchmarks, Koa GitHub Repository, Django Documentation, FastAPI Documentation, Express GitHub Releases*
