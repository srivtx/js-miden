# S22 Push Notifications — v7 Production Setup

## Connect to src/

This is the final state. All evolutions converge into a clean, production-ready structure.

### Directory Structure

```
S22-push-notifications/
├── src/
│   ├── index.ts            # Express app
│   ├── routes.ts           # HTTP endpoints
│   ├── service.ts          # Token storage + push logic
│   └── types.ts            # TypeScript interfaces
├── tests/
│   └── app.test.ts         # Node.js test runner + supertest
├── evolution_docs/         # This documentation
├── package.json
├── tsconfig.json
└── dist/                   # Compiled JS (gitignored)
```

### Key Production Decisions

**1. Token Registration**

```ts
export async function registerToken(data: { token: string; platform: 'ios' | 'android'; userId?: string }): Promise<DeviceToken> {
  const deviceToken: DeviceToken = {
    token: data.token,
    platform: data.platform,
    userId: data.userId,
    createdAt: new Date(),
  };
  tokens.set(data.token, deviceToken);
  return deviceToken;
}
```

Tokens are stored with platform metadata. The push sender selects the correct provider (FCM vs APNS) based on platform.

**2. Token Validation**

```ts
function isValidToken(token: string): boolean {
  return token.length >= 20 && token.length <= 500;
}
```

Invalid tokens are rejected before hitting the provider, saving quota and bandwidth.

**3. Batch Sending**

```ts
export async function sendBatch(data: { notifications: { title: string; body: string; tokens: string[] }[] }): Promise<{ sent: number; failed: number; notifications: PushNotification[] }> {
  const sentNotifications: PushNotification[] = [];
  let sent = 0;
  let failed = 0;

  for (const item of data.notifications) {
    const notification = await sendPush(item);
    sentNotifications.push(notification);
    if (notification.status === 'sent') sent++;
    else failed++;
  }

  return { sent, failed, notifications: sentNotifications };
}
```

Multiple notifications are processed in a single batch request.

**4. Delivery Tracking**

```ts
export async function getDeliveryStatus(id: string): Promise<PushNotification | undefined> {
  return notifications.get(id);
}
```

Every notification has a unique ID with per-token results. You can see exactly which tokens succeeded and which failed.

**5. Self-execution Guard**

```ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT);
}
```

Tests import `{ app }` without starting the server.

### The Intentional Bugs (For Learning)

The source code contains two bugs:

**Bug 1: No Token Validation**
```ts
// BUG: No token validation — sends to invalid tokens, wasting resources.
// We should validate tokens before attempting to send.
for (const token of data.tokens) {
  const device = tokens.get(token);
  // ...
}
```

Invalid tokens are sent to the provider instead of being rejected early.

**Bug 2: No Batching Optimization**
```ts
// BUG: No batching optimization — sends one by one.
// For 10,000 users this makes 10,000 individual requests instead of batching.
for (const item of data.notifications) {
  const notification = await sendPush(item);
  // ...
}
```

Batch sends are sequential instead of parallelized or using provider batch APIs.

**Why are these here?** To demonstrate that a push service without tests is worse than no push service. The tests in `app.test.ts` verify:
- Invalid tokens must be rejected with 400
- Batch send of 50 notifications must complete in < 100ms

### Evolution Summary

| Version | Pain | Fix |
|---------|------|-----|
| v1 | Direct send, no validation, no batching | Wrote naive JS |
| v2 | Type errors in push handling | Added TypeScript |
| v3 | Invalid tokens hitting provider | Added runtime validation |
| v4 | Silent delivery failures | Added structured logging |
| v5 | Batch logic broken, validation removed | Added comprehensive push tests |
| v6 | Legacy module system | Full ESM alignment |
| v7 | Disorganized project | Clean `src/` structure |

### Running the Final Version

```bash
npm install
npm run dev      # node --watch --loader ts-node/esm src/index.ts
npm run build    # tsc
npm start        # node dist/index.js
npm test         # node --test tests/**/*.test.ts
```

**Note:** This project uses the Node.js built-in test runner (not Jest/Vitest) to demonstrate native ESM + TypeScript testing without external test frameworks.
