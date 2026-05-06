# Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│ Express API  │────▶│ PostgreSQL  │
│             │◀────│              │◀────│             │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │  HTTP POST   │
                    │  (webhooks)  │
                    └──────────────┘
```

## Flow

1. **Registration**: `POST /api/webhooks` stores URL, event types, and secret
2. **Event Trigger**: `POST /api/events` accepts an event type and payload
3. **Fan-out**: System queries webhooks subscribed to that event type
4. **Delivery**: Async `sendWebhook` sends POST with headers:
   - `Content-Type: application/json`
   - `X-Webhook-Signature`: HMAC-SHA256 of payload
   - `X-Webhook-Event`: Event type
   - `X-Webhook-Attempt`: Attempt number
5. **Retry**: On failure, exponential backoff with jitter delays next attempt
6. **Logging**: Every attempt updates `delivery_logs` with status and response

## Retry Schedule

| Attempt | Delay (base) | With Jitter |
|---------|-------------|-------------|
| 1       | 1s          | 1.0 - 2.0s  |
| 2       | 2s          | 2.0 - 3.0s  |
| 3       | 4s          | 4.0 - 5.0s  |
| 4       | 8s          | 8.0 - 9.0s  |
| 5       | 16s         | 16.0 - 17.0s|

After 5 attempts, the delivery is marked `failed`.
