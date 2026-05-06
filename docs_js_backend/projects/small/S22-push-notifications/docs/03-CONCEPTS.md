# 03-CONCEPTS.md

## WHAT

A push notification service that:
1. Registers device tokens with platform metadata (iOS/Android)
2. Sends notifications via FCM and APNS mocks
3. Tracks per-token delivery results
4. Supports batch sending for high throughput
5. Validates tokens before wasting provider quota

## WHY

| Without This Service | With This Service |
|---------------------|-------------------|
| Invalid tokens burn API quota | Bad tokens rejected before any provider call |
| 1000 notifications = 1000 HTTP requests | 1000 notifications = 2-3 batch requests |
| No platform differentiation | iOS and Android routed to correct provider |
| Failed tokens never cleaned up | Invalid tokens identified and purged |
| Linear slowdown with scale | Near-constant time regardless of volume |

## HOW

### Step 1: Register Token
```typescript
POST /notifications/tokens
{
  "token": "fcm_token_abc123...",
  "platform": "android",
  "userId": "user-1"
}
```

### Step 2: Validate Before Send
```typescript
function isValidToken(token: string): boolean {
  return token.length >= 20 && token.length <= 500;
}

for (const token of data.tokens) {
  if (!isValidToken(token)) {
    results.push({ token, success: false, error: 'Invalid token' });
    continue;  // Skip provider call
  }
  // ... provider call
}
```

### Step 3: Batch by Provider
```typescript
// Group tokens by platform
const androidTokens = tokens.filter(t => t.platform === 'android');
const iosTokens = tokens.filter(t => t.platform === 'ios');

// FCM multicast: up to 500 tokens per request
await fcmSendMulticast(androidTokens, title, body);

// APNS HTTP/2: multiplex many streams over one connection
await apnsSendBatch(iosTokens, title, body);
```

### Step 4: Track Results
```typescript
{
  "id": "notif-123",
  "status": "sent",
  "results": [
    { "token": "t1", "success": true },
    { "token": "t2", "success": false, "error": "InvalidRegistration" }
  ]
}
```

## WRONG vs RIGHT

### WRONG: No Validation
```typescript
for (const token of data.tokens) {
  const result = await mockFcmSend(token, title, body);  // Wastes API call
}
```

### RIGHT: Validate First
```typescript
for (const token of data.tokens) {
  if (!isValidToken(token)) {
    results.push({ token, success: false, error: 'Invalid token' });
    continue;
  }
  const result = await mockFcmSend(token, title, body);
}
```

### WRONG: Sequential Loop
```typescript
for (const item of data.notifications) {
  await sendPush(item);  // One by one, O(n) latency
}
```

### RIGHT: Parallel Batch
```typescript
// Parallelize independent notifications
await Promise.all(data.notifications.map(n => sendPush(n)));

// Or use provider batch APIs
await fcmSendMulticast(allTokens, title, body);  // O(1) provider calls
```

## ASCII: System Architecture

```
+--------+     +-----------+     +-----------+     +---------+
| Client |---->|  Express  |---->| Validate  |---->|  FCM    |
+--------+     |  Router   |     |  Tokens   |     | Mock    |
               +-----------+     +-----------+     +---------+
                     |                |               |
                     v                v               v
               +-----------+     +-----------+     +---------+
               | Token DB  |     |  APNS     |     | Results |
               | (Memory)  |     |  Mock     |     |  Store  |
               +-----------+     +-----------+     +---------+
```

## ASCII: Batch Optimization

```
Without Batching:
  Req 1: token-a  --> FCM --> 10ms
  Req 2: token-b  --> FCM --> 10ms
  Req 3: token-c  --> FCM --> 10ms
  ...
  Total: 500ms for 50 tokens

With FCM Multicast:
  Req 1: [token-a, token-b, ..., token-500] --> FCM --> 10ms
  Total: 10ms for 500 tokens
```
