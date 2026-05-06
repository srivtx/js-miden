# 04-OLD-VS-NEW.md

## 2015 Approach (Naive / Sequential)

### Architecture
- One HTTP request per device token
- No validation before provider call
- Sequential `for` loop with `await` inside
- No platform-specific routing logic

### Code Pattern
```typescript
// 2015-style: One by one, blocking, wasteful
for (const token of tokens) {
  const result = await fcm.send({ token, notification: { title, body } });
  results.push(result);
}
```

### Problems
- 10,000 users = 10,000 HTTP requests
- Hitting FCM rate limit (600/min for free tier) after 600 users
- Invalid tokens waste quota and money
- 10,000 × 50ms = 8+ minutes of latency
- No feedback loop to clean up dead tokens

---

## 2025 Approach (Batched / Validated)

### Architecture
- Validate all tokens locally before any provider call
- Group by platform (FCM vs APNS)
- Use FCM multicast (500 tokens/request) and APNS HTTP/2 multiplexing
- Parallelize independent provider calls
- Clean up invalid tokens after each send

### Code Pattern
```typescript
// 2025-style: Validate, batch, parallelize
const validTokens = tokens.filter(isValidToken);

const androidTokens = validTokens.filter(t => t.platform === 'android');
const iosTokens = validTokens.filter(t => t.platform === 'ios');

// FCM: 500 tokens per request
const fcmBatches = chunk(androidTokens, 500);
const fcmPromises = fcmBatches.map(batch =>
  fcm.sendMulticast({ tokens: batch, notification: { title, body } })
);

// APNS: HTTP/2 multiplexing over single connection
const apnsPromise = apns.send(iosTokens, { alert: { title, body } });

const [fcmResults, apnsResults] = await Promise.all([
  Promise.all(fcmPromises),
  apnsPromise
]);

// Cleanup: remove invalid tokens from database
await removeInvalidTokens([...fcmResults, ...apnsResults]);
```

### Advantages
- Provider calls: 10,000 → 20 (for 10K Android tokens)
- Latency: 500s → < 1s
- Cost: linear with users → near-constant
- Quota efficiency: invalid tokens filtered before counting against limits
- Token hygiene: dead tokens removed automatically

## ASCII: Timeline Comparison

```
2015 (Sequential)                           2025 (Batched)
=================                           ================

100 notifications                           100 notifications
     |                                            |
     v                                            v
+---------+                               +-----------+
| token 1 | 10ms                          | Validate  | 1ms
| token 2 | 10ms                          | 100 tokens|
| token 3 | 10ms                          +-----------+
|   ...   |                                  |
| token 100| 10ms                            v
+---------+                               +-----------+
Total: 1000ms                             | FCM batch | 10ms
                                          | 100 tokens|
                                          +-----------+
                                          Total: ~15ms
```
