# S22 Push Notifications — v2 Add TypeScript

## The Bug: Types Catch Push Bugs

You add platform-specific sending:

```js
async function sendPush(token, title, body) {
  const device = tokens.get(token);
  const provider = device.platform === 'ios' ? sendApns : sendFcm;
  await provider(token, title, body);
}
```

**The bug:** `device` might be `undefined` if the token was never registered. `device.platform` throws `TypeError`. Another bug:
```js
const notification = {
  id: generateId(),
  title: data.title,
  body: data.body,
  tokens: data.tokens,
  status: 'pendng', // Bug: typo
};
```

Without types, `'pendng'` is just a string. Your delivery status query never finds it.

## The Fix: Add TypeScript

```ts
// types.ts
export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android';
  userId?: string;
  createdAt: Date;
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  tokens: string[];
  status: 'pending' | 'sent' | 'failed';
  results?: PushResult[];
  createdAt: Date;
}

export interface PushResult {
  token: string;
  success: boolean;
  error?: string;
}
```

```ts
export async function sendPush(data: { title: string; body: string; tokens: string[] }): Promise<PushNotification> {
  const notification: PushNotification = {
    id: generateId(),
    title: data.title,
    body: data.body,
    tokens: data.tokens,
    status: 'pending',
    createdAt: new Date(),
  };
  // ...
}
```

**What TS catches:**
- `device.platform` on `undefined` → compile error without guard
- `status: 'pendng'` → compile error: not in union type
- `tokens: 'single-token'` → compile error: must be `string[]`

## The Pain That Remains

TypeScript knows `token` is a `string`, but it doesn't enforce that tokens must be 20–500 characters. It doesn't know that `platform` must be validated before sending. We need runtime validation.

## What v3 Fixes

Validation. Ensure every token and notification is valid before it hits the provider.
