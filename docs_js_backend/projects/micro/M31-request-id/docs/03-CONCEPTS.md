# M31: Core Concepts

## WHAT
Request ID correlation attaches a unique identifier to every request for distributed tracing.

## WHY
Without correlation IDs, a single user action generating 50 microservice calls produces 50 unconnected log streams.

## HOW
```ts
// Attach early
app.use((req, res, next) => {
  const id = req.get('X-Request-ID') || crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
});

// Use in logger
console.log(JSON.stringify({ requestId: req.id, message: 'ok' }));
```

## WRONG vs RIGHT

**WRONG**: Generate ID only in error handler
```ts
app.use((err, req, res, next) => {
  const id = crypto.randomUUID(); // Too late! Not the same as request ID
  res.setHeader('X-Request-ID', id);
});
```

**RIGHT**: Generate at entry, propagate everywhere
```ts
app.use((req, res, next) => {
  const id = req.get('X-Request-ID') || crypto.randomUUID();
  res.setHeader('X-Request-ID', id);
  next();
});
```
