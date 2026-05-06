# M20: Webhook Receiver

A micro API for securely receiving webhooks from providers like GitHub and Stripe, with signature verification, replay protection, and async processing.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhook/:provider` | Receives webhooks from `github` or `stripe`. Verifies signature, checks timestamp, logs event, queues for async processing. |
| GET | `/events` | Lists recently received webhook events |
| GET | `/health` | Health check |

## Request

```bash
# GitHub webhook
curl -X POST http://localhost:3000/webhook/github \
  -H "X-Hub-Signature-256: sha256=..." \
  -H "X-GitHub-Delivery: 123e4567..." \
  -d '{"action":"opened","issue":{"number":1}}'

# Stripe webhook
curl -X POST http://localhost:3000/webhook/stripe \
  -H "Stripe-Signature: t=...,v1=...,v0=..." \
  -d '{"id":"evt_123","type":"invoice.paid"}'
```

## Response

```json
{
  "success": true,
  "provider": "github",
  "eventId": "123e4567-e89b-12d3-a456-426614174000",
  "processed": false,
  "queuedAt": "2024-06-15T14:00:00Z"
}
```

## Thinking Framework

### PHASE 1: Basic Receiver
- Accept POST at `/:provider`
- Verify HMAC signature using provider-specific secret
- Log the payload to console or memory store
- Return 200 quickly

### PHASE 2: Production Hardening
- **Signature Verification (HMAC)**: Use a constant-time comparison (`crypto.timingSafeEqual`) to prevent timing attacks. Compute HMAC over the raw body (not parsed JSON).
- **Replay Attacks**: Check the event timestamp. Reject webhooks older than 5 minutes (Stripe/GitHub both include timestamps). Also check idempotency via `X-GitHub-Delivery` or `id` field.
- **Idempotency**: Store processed event IDs. If the same event is delivered twice (common with retries), return 200 without re-processing.
- **Payload Size Limits**: Reject bodies larger than provider limits (e.g., Stripe ~100KB, GitHub ~25MB). Use `express.raw({ limit: '...' })`.
- **Async Processing**: Acknowledge immediately (200 OK), then process the event asynchronously (queue, worker, or `setImmediate`). Slow processing causes the provider to retry or mark the webhook as failed.

### PHASE 3: Security & Edge Cases
- **Timing Attacks**: Never use `===` for signature comparison. Always use `timingSafeEqual`.
- **Secret Rotation**: Support multiple secrets during rotation windows.
- **Provider Whitelist**: Reject unknown `:provider` values to prevent enumeration.
- **Content-Type Enforcement**: Only accept `application/json` (GitHub/Stripe).
- **Raw Body Access**: Express `json()` middleware parses the body. For HMAC verification, you need the raw string/Buffer. Use `express.raw()` or a body parser that preserves the raw payload.

## Bug

The buggy version is in `src/webhook.buggy.ts`. It has **three** vulnerabilities:

1. **No Signature Verification**: It accepts any POST request to `/webhook/:provider` without checking the HMAC signature. An attacker can forge webhook events (e.g., fake `invoice.paid` to grant free access, or fake `push` to trigger builds).
2. **No Timestamp / Replay Check**: It doesn't check the event age. An attacker can capture a legitimate webhook and replay it days later. For example, replaying a `charge.succeeded` event could double-credit a user.
3. **Synchronous Processing**: It processes the webhook inline (e.g., writing to DB, calling external APIs) before responding 200. If processing takes >10s (GitHub) or >30s (Stripe), the provider assumes failure and retries, causing duplicate work or inconsistent state.

## Setup

```bash
cd docs_js_backend/projects/micro/M20-webhook-receiver
npm install
npm run dev
```

## Tests

```bash
npm test
```
