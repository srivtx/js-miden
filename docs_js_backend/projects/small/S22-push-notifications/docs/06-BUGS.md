# 06-BUGS.md

## Bug 1: No Token Validation

**Location:** `src/service.ts`, `sendPush()` function, lines 73-78

**Current Code:**
```typescript
for (const token of data.tokens) {
  const device = tokens.get(token);
  const provider = device?.platform === 'ios' ? mockApnsSend : mockFcmSend;
  const result = await provider(token, data.title, data.body);
  results.push({ token, success: result.success, error: result.error });
}
```

**Real-World Impact:**

### Scenario: Marketing Campaign Gone Wrong
Your marketing team uploads a CSV of 50,000 user tokens for a promotional push. 5% of tokens are malformed (user typos, truncation during export).

- **Current behavior**: 2,500 invalid tokens sent to FCM/APNS
- **FCM cost**: $0 (free tier), but burns 2,500 of your 600/minute rate limit
- **APNS cost**: No direct cost, but repeated invalid sends flag your certificate
- **Result**: Campaign takes 2,500 × 10ms = 25 seconds longer. Some valid tokens hit rate limits and fail.

### Scenario: Empty Token Array
Frontend bug sends `"tokens": ["", "", ""]` due to uninitialized state.

- **Current behavior**: 3 provider calls with empty strings
- **Impact**: Wasted quota, polluted metrics (3 "failures" that aren't real failures)
- **Result**: Dashboard shows 3 bounces. Ops team investigates a non-issue.

### Scenario: Token Harvesting Attack
Attacker discovers your `/send` endpoint and sends millions of random tokens.

- **Current behavior**: Every random token triggers a provider API call
- **Impact**: API quota exhausted. Legitimate notifications blocked.
- **Cost**: AWS SNS charges $0.50 per million requests. 10M attacks = $5 + blocked service.

**Severity:** MEDIUM-HIGH — Wastes money, pollutes metrics, creates attack surface

**Fix:** Validate token format before any provider call.

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

---

## Bug 2: No Batching Optimization

**Location:** `src/service.ts`, `sendBatch()` function, lines 93-98

**Current Code:**
```typescript
for (const item of data.notifications) {
  const notification = await sendPush(item);  // Sequential, one by one
  sentNotifications.push(notification);
}
```

**Real-World Impact:**

### Scenario: Flash Sale Notification
Your e-commerce app has 10,000 active users. A flash sale starts and you need to notify everyone immediately.

- **Current behavior**: 10,000 sequential calls × 10ms = 100 seconds
- **User impact**: First user notified at T+0, last user notified at T+100s
- **Business impact**: Flash sale inventory sells out in 30 seconds. 7,000 users never got the notification.
- **Result**: Revenue loss, user complaints, "your app is slow" reviews.

### Scenario: FCM Rate Limit
Free tier FCM allows 600 requests/minute.

- **Current behavior**: 1,000 notifications = 1,000 requests
- **Impact**: 400 requests rejected with 429 Too Many Requests
- **Result**: 40% of users never notified. No retry mechanism means permanent loss.

### Scenario: Battery Drain on Devices
Each FCM/APNS request triggers a separate TCP connection (without HTTP/2 multiplexing).

- **Current behavior**: 10,000 separate TCP handshakes
- **Device impact**: Battery drain from repeated radio wake-ups
- **Result**: Users uninstall your app due to battery complaints.

**Severity:** HIGH — Directly limits scale and wastes resources

**Fix:** Use `Promise.all` for parallelization and provider batch APIs.

```typescript
// Parallelize independent sends
const notifications = await Promise.all(
  data.notifications.map(item => sendPush(item))
);

// Or use FCM multicast (production)
const batches = chunk(allTokens, 500);
await Promise.all(batches.map(batch => fcmSendMulticast(batch)));
```

---

## Additional Bug Surface

### No Token Cleanup
Invalid tokens are never removed from the store. Over months, the token database fills with dead registrations, slowing lookups and inflating costs.

**Fix:** After each send campaign, delete tokens that returned `InvalidRegistration` or `BadDeviceToken`.

### No Rate Limiting
An attacker could register 1M fake tokens and trigger sends that exhaust API quota and memory.

**Fix:** Add per-IP and per-user rate limits on both registration and send endpoints.
