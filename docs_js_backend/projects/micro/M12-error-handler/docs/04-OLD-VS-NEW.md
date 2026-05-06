# Old Ways vs New Ways (2025)

## Pattern: Error Response Format

### The Old Way (2015-2020)
```javascript
// Every API invented its own format
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});
```
**Why we did it:** It was simple and worked. Most tutorials taught this pattern.

**Why it is wrong now:**
1. No standard field names. One API uses `error`, another uses `message`.
2. No `status` field — clients must parse the HTTP status code separately.
3. No `instance` field — clients cannot correlate errors with requests.
4. No extensibility — you cannot add metadata like `retryAfter` without breaking clients.

### The New Way (2025)
```typescript
res.status(status).json({
  type: 'about:blank',
  title,
  status,
  detail: err.message,
  instance: req.originalUrl,
});
```
**Why it is better:**
1. Standardized by RFC 7807. Any client that knows Problem Details can parse it.
2. Self-describing. The `status` field mirrors the HTTP status code.
3. Traceable. The `instance` field tells you which request failed.
4. Extensible. Add `errorId`, `retryAfter`, or custom fields without breaking existing clients.

**When to still use old way:** Internal microservices where you control all clients and want minimal payload. Even then, RFC 7807 is only ~50 bytes larger.

### Migration Path
1. Replace `{ error: ... }` with `{ type, title, status, detail, instance }`.
2. Update client-side error parsers to look for `detail` instead of `error`.
3. Add `application/problem+json` Content-Type.

---

## Pattern: Async Error Handling

### The Old Way (2015-2020)
```javascript
// Express 4 + manual wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

app.get('/data', asyncHandler(async (req, res) => {
  const data = await db.query();
  res.json(data);
}));
```
**Why we did it:** Express 4 did not catch rejected promises in async route handlers. Without the wrapper, unhandled rejections crashed the process.

**Why it is wrong now:**
1. Boilerplate in every route.
2. Easy to forget the wrapper.
3. Express 5 handles this natively.

### The New Way (2025)
```typescript
// Express 5 - no wrapper needed
app.get('/data', async (req, res) => {
  const data = await db.query();
  res.json(data);
});
```
**Why it is better:**
1. Zero boilerplate.
2. Impossible to forget.
3. Native support, no extra function call overhead.

**When to still use old way:** If you are stuck on Express 4 (many legacy codebases are), the wrapper function is still the best practice. But new projects should use Express 5.

### Migration Path
1. Upgrade to Express 5.
2. Remove `asyncHandler` wrappers.
3. Add explicit try/catch only where you need to transform errors (e.g., validation).

---

## Pattern: Stack Trace Exposure

### The Old Way (2015-2020)
```javascript
// Always include the stack
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack,
  });
});
```
**Why we did it:** It made debugging easy. Developers could see exactly where errors occurred without checking logs.

**Why it is wrong now:**
1. Major security risk. Stack traces leak file paths, dependencies, and internal logic.
2. Attackers use stack traces to fingerprint frameworks and find known vulnerabilities.
3. GDPR and SOC 2 auditors flag this as an information disclosure risk.

### The New Way (2025)
```typescript
const isDev = process.env.NODE_ENV !== 'production';

const problem = {
  type: 'about:blank',
  title: 'Internal Server Error',
  status: 500,
  detail: err.message,
  instance: req.originalUrl,
  ...(isDev && { stack: err.stack }),
};
```
**Why it is better:**
1. Safe by default.
2. Developers still see stacks locally.
3. One line of code eliminates a security vulnerability.

**When to still use old way:** Never in production. Only in local development or behind a VPN with no external access.

### Migration Path
1. Add `NODE_ENV` checks to all error handlers.
2. Default to excluding the stack if `NODE_ENV` is undefined.
3. Set up centralized logging so production errors are still traceable.
