# 09-bugs.md

## Bug 1: No Token Validation

**Location:** `src/service.ts` in `sendPush()`

**Issue:** Tokens are sent to providers without validation. Invalid, malformed, or empty tokens waste API quota and processing time.

**Impact:**
- Wasted provider API calls
- Slower response times
- Higher cloud costs
- Polluted delivery metrics

**Fix:**
```typescript
function isValidToken(token: string): boolean {
  return token.length >= 20 && token.length <= 500;
}

for (const token of data.tokens) {
  if (!isValidToken(token)) {
    results.push({ token, success: false, error: 'Invalid token' });
    continue;
  }
  // ... provider call
}
```

## Bug 2: No Batching

**Location:** `src/service.ts` in `sendBatch()`

**Issue:** The batch endpoint loops through notifications and calls `sendPush` sequentially. For 10,000 users this makes 10,000 individual HTTP requests instead of leveraging provider batch APIs.

**Impact:**
- Linear slowdown with user count
- Provider rate limiting
- timeouts under load

**Fix:**
```typescript
// FCM supports up to 500 tokens per multicast request
// APNS supports HTTP/2 multiplexing
const batches = chunk(allTokens, 500);
await Promise.all(batches.map(batch => fcmSendMulticast(batch)));
```
