# M34: Intentional Bug

## Location
`src/validator.ts` in `validateHeaders()` function.

## Symptoms
- Valid requests with lowercase headers (e.g., `content-type: application/json`) fail validation
- Some HTTP/2 clients (which lowercase all headers) are incorrectly rejected
- Proxy servers that normalize headers to lowercase trigger false alarms

## Reproduction
```ts
await request(app).get('/public').set('content-type', 'application/json');
// Returns warning about invalid Content-Type because value is undefined
```

## Root Cause
```ts
const value = req.headers[rule.name]; // rule.name is 'Content-Type', but req.headers key is 'content-type'
```

## Fix
```ts
const value = req.get(rule.name); // Express normalizes case
// OR
const value = req.headers[rule.name.toLowerCase()];
```

## Real-World Impact
HTTP/2 mandates lowercase headers. A modern client using HTTP/2 to talk to a reverse proxy that forwards to your Express app will have all headers rejected, breaking the API for 30%+ of mobile traffic.
