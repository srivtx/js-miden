# 05-BUILD.md

## Prerequisites

- Node.js 20+
- npm or pnpm

## Step-by-Step Build

### Step 1: Clone and Install
```bash
cd S22-push-notifications
npm install
```

### Step 2: Understand the Project Structure
```
S22-push-notifications/
├── src/
│   ├── index.ts      # Express server setup
│   ├── routes.ts     # HTTP endpoints
│   ├── service.ts    # Business logic (BUGS HERE)
│   └── types.ts      # TypeScript interfaces
├── tests/
│   └── app.test.ts   # Failing tests prove bugs
├── docs/
│   └── (this documentation)
├── package.json
└── tsconfig.json
```

### Step 3: Run the Tests (They Will Fail)
```bash
npm test
```

Expected failures:
- `should reject invalid tokens before sending` — accepts any token without validation
- `should batch send efficiently` — sequential processing, no batch optimization

### Step 4: Fix Bug 1 — Add Token Validation

Edit `src/service.ts` in `sendPush()`:
```typescript
for (const token of data.tokens) {
  if (!isValidToken(token)) {
    results.push({ token, success: false, error: 'Invalid token' });
    continue;
  }
  
  const device = tokens.get(token);
  const provider = device?.platform === 'ios' ? mockApnsSend : mockFcmSend;
  const result = await provider(token, data.title, data.body);
  results.push({ token, success: result.success, error: result.error });
}
```

Also add validation to the route handler in `src/routes.ts`:
```typescript
router.post('/send', async (req: Request, res: Response) => {
  const invalidTokens = req.body.tokens.filter((t: string) => !isValidToken(t));
  if (invalidTokens.length > 0) {
    return res.status(400).json({ error: `Invalid tokens: ${invalidTokens.join(', ')}` });
  }
  // ... existing logic
});
```

### Step 5: Fix Bug 2 — Parallelize Batch Sends

Edit `src/service.ts` in `sendBatch()`:
```typescript
export async function sendBatch(data: { notifications: ... }): Promise<...> {
  // Parallelize all notifications
  const notifications = await Promise.all(
    data.notifications.map(item => sendPush(item))
  );
  
  const sent = notifications.filter(n => n.status === 'sent').length;
  const failed = notifications.filter(n => n.status === 'failed').length;
  
  return { sent, failed, notifications };
}
```

**Even better** — use provider batch APIs:
```typescript
// FCM multicast: up to 500 tokens per request
const fcmResult = await mockFcmSendMulticast(
  androidTokens.map(t => t.token),
  title, body
);

// APNS HTTP/2 batch
const apnsResult = await mockApnsSendBatch(
  iosTokens.map(t => t.token),
  title, body
);
```

### Step 6: Run Tests Again
```bash
npm test
```

All tests should now pass.

### Step 7: Run the Server
```bash
npm run dev
```

Test with curl:
```bash
# Register a token
curl -X POST http://localhost:3000/notifications/tokens \
  -H "Content-Type: application/json" \
  -d '{"token":"valid_android_token_12345","platform":"android","userId":"user-1"}'

# Send to valid token
curl -X POST http://localhost:3000/notifications/send \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","body":"World","tokens":["valid_android_token_12345"]}'

# Try invalid tokens (should fail)
curl -X POST http://localhost:3000/notifications/send \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","body":"World","tokens":["short","","x"]}'

# Batch send
curl -X POST http://localhost:3000/notifications/send-batch \
  -H "Content-Type: application/json" \
  -d '{"notifications":[{"title":"A","body":"B","tokens":["valid_android_token_12345"]}]}'
```

### Step 8: Production Upgrade Path

1. Replace mock providers with Firebase Admin SDK and `node-apn`
2. Replace in-memory token store with Redis or PostgreSQL
3. Implement token cleanup job (remove invalid registrations weekly)
4. Add rate limiting per app and per user
5. Use FCM topics for broadcast notifications (news, promotions)
6. Add delivery receipt webhook endpoints
