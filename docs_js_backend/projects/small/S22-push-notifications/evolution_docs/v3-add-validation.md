# S22 Push Notifications — v3 Add Validation

## The Bug: Validation Catches Push Bugs

Your TypeScript push service accepts any request:

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

Without validation:
- `tokens: ['short', '', 'x']` — TypeScript says `string[]`, but these are invalid tokens
- `title: ''` — empty title is useless to the user
- `tokens: []` — empty array wastes a request to the provider
- `data.tokens` contains duplicates — you send the same notification twice to the same device

TypeScript ensures the types match, but it doesn't validate token formats or payload sanity at runtime.

## The Fix: Runtime Push Validation

```ts
function isValidToken(token: string): boolean {
  return token.length >= 20 && token.length <= 500;
}

function validateSendRequest(data: { title: string; body: string; tokens: string[] }): void {
  if (!data.title || data.title.trim().length === 0) {
    throw new Error('Title is required');
  }
  if (!data.body || data.body.trim().length === 0) {
    throw new Error('Body is required');
  }
  if (!data.tokens || data.tokens.length === 0) {
    throw new Error('At least one token is required');
  }
  const invalid = data.tokens.filter(t => !isValidToken(t));
  if (invalid.length > 0) {
    throw new Error(`Invalid tokens: ${invalid.join(', ')}`);
  }
}
```

```ts
export async function sendPush(data: { title: string; body: string; tokens: string[] }): Promise<PushNotification> {
  validateSendRequest(data);
  // ...
}
```

**What validation prevents:**
- Short/invalid tokens are rejected before hitting the provider
- Empty titles and bodies are blocked
- Empty token arrays are refused
- Duplicate tokens can be deduplicated before sending

## The Pain That Remains

You validate requests, but you still have no visibility into push delivery. When notifications fail, you don't know if it's a token issue, a provider issue, or a payload issue. There's no logging of send latency, failure reasons, or delivery rates.

## What v4 Fixes

Logging. Observe push behavior in production.
