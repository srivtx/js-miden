# Troubleshooting: API Gateway Basics

## Gateway Hangs on Request

**Symptom:** `curl http://localhost:3000/users/profile` hangs forever.

**Cause:** The backend service is not running, or the gateway has no timeout.

**Solution:**
1. Ensure the user service is running on port 3001.
2. Add a timeout to the proxy request (see `04-wrong-vs-right.md`).

## Gateway Crashes on Backend Error

**Symptom:** Gateway process exits with `ECONNREFUSED`.

**Cause:** No error handler on the proxy request.

**Solution:** Attach an `error` event listener to the proxy request.

## Request ID Missing

**Symptom:** Response does not contain `X-Request-ID`.

**Cause:** Request ID middleware is not registered before the proxy middleware.

**Solution:** Register middleware in the correct order:
```typescript
app.use(requestIdMiddleware);
app.use(proxyMiddleware);
```

## Tests Time Out

**Symptom:** `npm test` hangs on the timeout test.

**Cause:** This is expected behavior due to the bug. The gateway has no timeout, so the test waits forever.

**Solution:** Fix the bug by adding timeout handling to `src/gateway.ts`.
