# Concepts Explained

## Concept: Error Handling Patterns

### What Is It?
Error handling patterns are structured approaches to catching, formatting, and responding to failures in an application. In Express, this means a 4-arity middleware function: `(err, req, res, next) => { ... }`.

### Why Do We Use It?
Without a centralized error handler, every route must handle its own errors. This leads to inconsistent responses, duplicated code, and forgotten edge cases. A single error handler ensures every failure follows the same path.

### How Does It Work?

```
┌─────────────────────────────────────────────────────────────┐
│  Express Middleware Chain                                   │
│                                                             │
│  app.use(routeA);                                           │
│  app.use(routeB);  ──► throws AppError(400)                │
│  app.use(routeC);                                           │
│                                                             │
│  app.use(errorHandler);  ◄── Express skips to here         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

When any middleware calls `next(err)` or throws an error, Express skips all remaining regular middleware and invokes the first 4-arity middleware (the error handler).

### Code Example
```typescript
// routes.ts
router.post('/divide', (req, res, next) => {
  const { a, b } = req.body;
  if (typeof a !== 'number' || typeof b !== 'number') {
    next(new AppError(400, 'Bad Request', 'Both a and b must be numbers'));
    return;
  }
  res.json({ result: a / b });
});

// middleware/errorHandler.ts
export function errorHandler(err, req, res, _next) {
  const problem = {
    type: 'about:blank',
    title: err.title || 'Internal Server Error',
    status: err.status || 500,
    detail: err.message,
    instance: req.originalUrl,
  };
  res.status(problem.status).json(problem);
}
```

### Common Misconceptions
- **Wrong way:** "I don't need an error handler. I'll handle errors in each route."
  - **Right way:** You will forget an edge case. Centralized handling is the only way to guarantee consistency.
- **Wrong way:** "Error handlers go at the top of the file."
  - **Right way:** Error handlers MUST be registered AFTER all routes. Express matches middleware in order. If you put the error handler first, it will never run.

### Related Concepts
- Express middleware chain
- RFC 7807 Problem Details
- `res.headersSent`

---

## Concept: RFC 7807 Problem Details

### What Is It?
RFC 7807 defines a standard format for HTTP error responses. It specifies a JSON object with these fields:
- `type`: A URI that identifies the problem type (default: `about:blank`).
- `title`: A short, human-readable summary of the problem type.
- `status`: The HTTP status code.
- `detail`: A human-readable explanation specific to this occurrence.
- `instance`: A URI that identifies the specific occurrence (usually the request path).

### Why Do We Use It?
Before RFC 7807, every API used a different error format. A client integrating with 5 APIs had to write 5 different error parsers. RFC 7807 provides a universal contract: if you see `application/problem+json`, you know exactly which fields to expect.

### How Does It Work?

```
┌─────────────────────────────────────────────────────────────┐
│  Before RFC 7807                                            │
│                                                             │
│  API A: { "error": "Invalid input" }                        │
│  API B: { "message": "Bad request", "code": 400 }           │
│  API C: { "status": 400, "error_description": "..." }       │
│                                                             │
│  Client needs 3 parsers.                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  After RFC 7807                                             │
│                                                             │
│  API A: { "type":"...", "title":"Bad Request", ... }       │
│  API B: { "type":"...", "title":"Not Found", ... }         │
│  API C: { "type":"...", "title":"Unauthorized", ... }      │
│                                                             │
│  Client needs 1 parser.                                   │
└─────────────────────────────────────────────────────────────┘
```

### Code Example
```typescript
const problem = {
  type: 'about:blank',
  title: 'Bad Request',
  status: 400,
  detail: 'Both a and b must be numbers',
  instance: '/divide',
};

res.status(400)
   .set('Content-Type', 'application/problem+json')
   .json(problem);
```

### Common Misconceptions
- **Wrong way:** "RFC 7807 is only for big enterprises. My small API doesn't need it."
  - **Right way:** The spec is trivial to implement and pays off immediately when you have even one client. It is not "enterprise" — it is just good design.
- **Wrong way:** "I must host documentation at the `type` URI."
  - **Right way:** `about:blank` is explicitly allowed when you don't have a custom URI. You can add custom types later without breaking clients.

### Related Concepts
- HTTP status codes (RFC 9110)
- `application/problem+json` media type
- OpenAPI error schemas

---

## Concept: `res.headersSent`

### What Is It?
`res.headersSent` is a boolean property on the Node.js `ServerResponse` object. It becomes `true` as soon as the HTTP response headers have been written to the socket.

### Why Do We Use It?
Once headers are sent, the response is "committed." You cannot change the status code, add headers, or send a different body. If you try, Node.js throws `ERR_HTTP_HEADERS_SENT` and the process crashes (if uncaught).

### How Does It Work?

```
Route handler timeline:

  0ms        5ms         10ms        15ms
   │          │           │           │
   ▼          ▼           ▼           ▼
┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐
│ Start│   │res.  │   │Error │   │Error │
│      │   │json()│   │throws│   │handler│
│      │   │      │   │      │   │tries  │
│      │   │headers│  │      │   │res.   │
│      │   │sent   │   │      │   │status │
└──────┘   └──────┘   └──────┘   └──────┘
              │                        │
              ▼                        ▼
         headersSent = true        CRASH! ERR_HTTP_HEADERS_SENT
```

### Code Example
```typescript
export function errorHandler(err, req, res, _next) {
  // GUARD CLAUSE: prevent double-response crash
  if (res.headersSent) {
    console.error('Error after headers sent:', err);
    return;
  }

  res.status(err.status || 500).json({ ... });
}
```

### Common Misconceptions
- **Wrong way:** "I'll just wrap my error handler in try/catch."
  - **Right way:** `res.status().json()` throws synchronously. A try/catch around it would catch the error, but the response is still corrupted. The correct fix is to check `headersSent` BEFORE attempting to write.
- **Wrong way:** "If headers are sent, the user already got their data, so the error doesn't matter."
  - **Right way:** The error DOES matter — it means your cleanup logic failed, or your stream errored, or your database connection closed mid-response. You must log it. You just can't send a second response.

### Related Concepts
- Node.js HTTP streams
- `res.writableEnded`
- Error events on streams

---

## Concept: Stack Traces

### What Is It?
A stack trace is a textual representation of the call stack at the point where an error was thrown. It shows the sequence of function calls that led to the error, including file paths and line numbers.

### Why Do We Use It?
Stack traces are the single most useful debugging tool in software development. They tell you exactly where an error originated and how it propagated through your code.

### How Does It Work?

When JavaScript throws an error, the engine captures the current call stack and attaches it to the error object as `err.stack`. It looks like this:

```
Error: Division by zero is not allowed
    at /app/src/routes.ts:15:12
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
    at next (/app/node_modules/express/lib/router/route.js:137:13)
    at Route.dispatch (/app/node_modules/express/lib/router/route.js:112:3)
```

This reveals:
- The error message.
- Your source file: `/app/src/routes.ts`.
- Your line number: `15`.
- Your dependency versions (from `node_modules/express/...`).
- Your deployment path (`/app/`).

### Code Example
```typescript
const isDev = process.env.NODE_ENV !== 'production';

const problem = {
  type: 'about:blank',
  title: 'Internal Server Error',
  status: 500,
  detail: err.message,
  instance: req.originalUrl,
  // Only include stack in development
  ...(isDev && { stack: err.stack }),
};
```

### Common Misconceptions
- **Wrong way:** "Stack traces are harmless. They're just for debugging."
  - **Right way:** Stack traces are a goldmine for attackers. They reveal your file structure, framework versions, and sometimes environment variables in closure captures.
- **Wrong way:** "I'll check NODE_ENV but default to including the stack if it's undefined."
  - **Right way:** Default to SAFE. If `NODE_ENV` is undefined, assume production and exclude the stack. It is better to make debugging slightly harder than to leak internals.

### Related Concepts
- `Error.captureStackTrace()`
- Source maps
- Log aggregation and centralized logging
