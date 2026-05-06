# Security

## Payload Signing

Every webhook includes `X-Webhook-Signature`:

```
X-Webhook-Signature: sha256=<hmac_hex>
```

The receiver should verify:

```typescript
const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
if (`sha256=${expected}` !== signature) throw new Error('Invalid signature');
```

## Timing Attacks

Use `crypto.timingSafeEqual` for signature comparison to prevent timing attacks.

## Timeout

All outbound requests use a 10-second timeout with `AbortController`. Without this, connections hang indefinitely when receivers are down.

## Idempotency

Receivers should handle duplicate deliveries. Include an event ID in the payload for deduplication.
