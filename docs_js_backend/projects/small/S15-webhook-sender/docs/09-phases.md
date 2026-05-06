# Phases

## Phase 1: MVP

- [x] Register webhook URLs
- [x] Send POST requests on events
- [x] Retry with exponential backoff
- [x] Log delivery attempts

## Phase 2: Enhancements

- [x] Payload signing with HMAC-SHA256
- [x] Delivery timeout (10s)
- [x] At-least-once delivery semantics
- [x] Jitter in backoff to prevent thundering herd

## Phase 3: Advanced

- [ ] Circuit breaker pattern (pause failing webhooks)
- [ ] Webhook endpoint validation (SSL, DNS)
- [ ] Batch delivery for high-volume events
- [ ] Retry schedule customization per webhook
- [ ] Dead letter queue for permanently failed deliveries

## Known Bugs (Intentional)

1. **No retry**: If `sendWebhook` returned immediately on failure without retry loop
2. **No timeout**: Without `AbortController`, HTTP hangs forever
3. **No signature**: Without HMAC, receivers cannot verify sender authenticity
