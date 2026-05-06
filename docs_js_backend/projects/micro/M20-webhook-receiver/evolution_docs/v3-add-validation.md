# M20 Webhook Receiver — v3 Add Validation

## The Bug: Validation Catches USER Bugs

Your TypeScript webhook receiver accepts any POST request:

```bash
# No signature — accepted
curl -X POST https://your-api.com/webhook/github -d '{"action":"opened"}'

# Wrong provider — accepted (falls through to default)
curl -X POST https://your-api.com/webhook/attacker -d '{"evil":true}'

# Replay attack — accepted 100 times
curl -X POST https://your-api.com/webhook/github -d '{"action":"opened"}'
# (run 100 times)

# Duplicate event — accepted
curl -X POST https://your-api.com/webhook/stripe -d '{"id":"evt_123","type":"invoice.paid"}'
# Stripe retries after timeout — processed again
```

Without validation:
- **Any payload is accepted** — no signature verification
- **Any provider is accepted** — no whitelist
- **Any timestamp is accepted** — replay attacks work forever
- **Duplicate events are processed** — no idempotency

## The Fix: Multi-layer Validation

```ts
const SECRETS: Record<string, string> = {
  github: process.env.GITHUB_WEBHOOK_SECRET || 'default-github-secret',
  stripe: process.env.STRIPE_WEBHOOK_SECRET || 'default-stripe-secret',
};

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
const processedEvents = new Set<string>();

export function isValidProvider(provider: string): boolean {
  return provider === 'github' || provider === 'stripe';
}

export function verifyWebhook(provider: string, payload: Buffer, headers: IncomingHttpHeaders) {
  const secret = SECRETS[provider];
  if (!secret) {
    return { valid: false, reason: 'No secret configured' };
  }

  if (provider === 'github') {
    const signature = headers['x-hub-signature-256'] as string | undefined;
    if (!signature) {
      return { valid: false, reason: 'Missing signature header' };
    }

    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (!timingSafeCompare(signature, expected)) {
      return { valid: false, reason: 'Signature mismatch' };
    }

    const eventId = (headers['x-github-delivery'] as string) || crypto.randomUUID();
    return {
      valid: true,
      eventId,
      tooOld: false,
      duplicate: processedEvents.has(eventId),
    };
  }

  if (provider === 'stripe') {
    const signature = headers['stripe-signature'] as string | undefined;
    if (!signature) {
      return { valid: false, reason: 'Missing signature header' };
    }

    // Parse Stripe-Signature: t=...,v1=...
    const elements = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key.trim()] = value;
      return acc;
    }, {} as Record<string, string>);

    const timestamp = parseInt(elements['t'] || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > MAX_AGE_MS / 1000) {
      return { valid: true, eventId: elements['t'] || 'unknown', tooOld: true };
    }

    const signedPayload = `${timestamp}.${payload.toString('utf8')}`;
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
    if (!timingSafeCompare(elements['v1'] || '', expected)) {
      return { valid: false, reason: 'Signature mismatch' };
    }

    const parsed = JSON.parse(payload.toString('utf8'));
    const eventId = parsed.id || crypto.randomUUID();
    return {
      valid: true,
      eventId,
      tooOld: false,
      duplicate: processedEvents.has(eventId),
    };
  }

  return { valid: false, reason: 'Unknown provider' };
}
```

**What validation prevents:**
- **Forged webhooks:** HMAC signature verification with `crypto.timingSafeEqual`
- **Replay attacks:** Stripe timestamps rejected after 5 minutes
- **Duplicate processing:** `processedEvents` Set tracks seen event IDs
- **Unknown providers:** Explicit whitelist (`github`, `stripe`)

## The Pain That Remains

A webhook fails verification. You have no idea why. Was the signature wrong? Was the timestamp too old? Was the secret misconfigured? Your logs are empty.

## What v4 Fixes

Logging. Debug webhook failures without guessing.
