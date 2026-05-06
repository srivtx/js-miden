# S22 Push Notifications — v4 Add Logging

## The Bug: Production Visibility Crisis

Your push service is supposed to deliver notifications reliably. But in production:
- You don't know how many notifications were sent vs failed
- You don't know if invalid tokens are being filtered
- You can't tell if batch sends are efficient or slow
- You have no record of provider errors

```ts
// Without logging — silent sending
export async function sendPush(data: { title: string; body: string; tokens: string[] }): Promise<PushNotification> {
  const notification: PushNotification = {
    id: generateId(),
    title: data.title,
    body: data.body,
    tokens: data.tokens,
    status: 'pending',
    createdAt: new Date(),
  };
  
  const results: PushResult[] = [];
  for (const token of data.tokens) {
    const device = tokens.get(token);
    const provider = device?.platform === 'ios' ? mockApnsSend : mockFcmSend;
    const result = await provider(token, data.title, data.body);
    results.push({ token, success: result.success, error: result.error });
  }
  
  notification.results = results;
  notification.status = results.some(r => r.success) ? 'sent' : 'failed';
  return notification;
}
```

A notification fails for 50 tokens. You have no log. The marketing team asks "How many saw the flash sale notification?" You can't answer.

## The Fix: Structured Logging

```ts
import { logger } from './logger.js';

export async function sendPush(data: { title: string; body: string; tokens: string[] }): Promise<PushNotification> {
  validateSendRequest(data);
  
  const notification: PushNotification = {
    id: generateId(),
    title: data.title,
    body: data.body,
    tokens: data.tokens,
    status: 'pending',
    createdAt: new Date(),
  };
  
  notifications.set(notification.id, notification);
  logger.info({ notificationId: notification.id, tokenCount: data.tokens.length }, 'Push notification created');
  
  const results: PushResult[] = [];
  for (const token of data.tokens) {
    const device = tokens.get(token);
    if (!device) {
      logger.warn({ token }, 'Token not registered, skipping');
      results.push({ token, success: false, error: 'Token not registered' });
      continue;
    }
    
    const provider = device.platform === 'ios' ? mockApnsSend : mockFcmSend;
    logger.info({ notificationId: notification.id, token, platform: device.platform }, 'Sending push');
    
    const result = await provider(token, data.title, data.body);
    results.push({ token, success: result.success, error: result.error });
    
    if (result.success) {
      logger.info({ notificationId: notification.id, token }, 'Push delivered');
    } else {
      logger.warn({ notificationId: notification.id, token, error: result.error }, 'Push failed');
    }
  }
  
  notification.results = results;
  notification.status = results.some(r => r.success) ? 'sent' : 'failed';
  const successCount = results.filter(r => r.success).length;
  logger.info({ notificationId: notification.id, successCount, failedCount: results.length - successCount }, 'Push notification completed');
  
  return notification;
}
```

Now logs tell the story:
```json
{"level":"info","notificationId":"abc123","tokenCount":100,"msg":"Push notification created"}
{"level":"info","notificationId":"abc123","token":"tok_1","platform":"ios","msg":"Sending push"}
{"level":"warn","notificationId":"abc123","token":"tok_2","error":"BadDeviceToken","msg":"Push failed"}
{"level":"info","notificationId":"abc123","successCount":98,"failedCount":2,"msg":"Push notification completed"}
```

**Ah.** 98 delivered, 2 failed with invalid tokens. Those tokens should be removed from the database.

## The Pain That Remains

You refactor `sendPush` and accidentally remove the token validation. Invalid tokens are sent to the provider. Your logs show provider rejections, but you don't have a test that verifies invalid tokens are rejected before sending.

## What v5 Fixes

Testing. Every push behavior needs a test.
