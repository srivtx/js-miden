# A04 Payment Orchestrator - Payment Flow

## Standard Payment Flow

```
┌─────────┐    POST /payments    ┌─────────────┐
│ Client  │─────────────────────▶│   Server    │
└─────────┘                      └──────┬──────┘
                                        │
                                        ▼
                               ┌────────────────┐
                               │ Check Idempotency
                               │ Key Exists?    │
                               └───────┬────────┘
                                       │
                          ┌────────────┴────────────┐
                          ▼                         ▼
                     Yes / Exists              No / New
                          │                         │
                          ▼                         ▼
                   Return Existing            Create Payment
                   Payment                    Record
                          │                         │
                          │                         ▼
                          │                ┌────────────────┐
                          │                │ Try Primary    │
                          │                │ Provider       │
                          │                │ (Stripe)       │
                          │                └───────┬────────┘
                          │                        │
                          │           ┌────────────┴────────────┐
                          │           ▼                         ▼
                          │      Success                    Failure
                          │           │                         │
                          │           │                         ▼
                          │           │                ┌────────────────┐
                          │           │                │ Try Fallback   │
                          │           │                │ Provider       │
                          │           │                │ (PayPal)       │
                          │           │                └───────┬────────┘
                          │           │                        │
                          │           │           ┌────────────┴────────────┐
                          │           │           ▼                         ▼
                          │           │      Success                    Failure
                          │           │           │                         │
                          │           │           ▼                         ▼
                          │           │    Update Status              Mark Failed
                          │           │    = Succeeded                Update Status
                          │           │                                 = Failed
                          │           │                         │
                          └───────────┴─────────────────────────┘
                                        │
                                        ▼
                                  Return Response
```

## Fallback Strategy

### Primary Provider Failure

When the primary provider (Stripe) fails:

1. Circuit breaker records the failure
2. If threshold reached, circuit opens
3. Payment service immediately tries fallback (PayPal)
4. Attempt history records both tries

### All Providers Failure

If both providers fail:

1. Payment status set to `failed`
2. All attempts recorded with error messages
3. Client receives 200 with failed status
4. Client can retry with same idempotency key

## Idempotency Implementation

### Key Generation

Client-provided key:
```typescript
const idempotencyKey = request.idempotencyKey || generateFromRequest(request);
```

Auto-generated key (deterministic):
```typescript
function generateFromRequest(req) {
  return hash(`${req.amount}:${req.currency}:${req.customerEmail}:${req.description}`);
}
```

### Deduplication Flow

```
1. Extract idempotencyKey from request
2. Check PaymentStore.idempotencyMap
3. If exists:
   - Return existing payment (200 OK)
   - Do NOT create new charge
4. If new:
   - Process payment normally
   - Store mapping: idempotencyKey → paymentId
   - Return payment (201 Created)
```

## Refund Flow

```
1. Client POST /payments/:id/refund
2. Validate payment exists and status is "succeeded"
3. Call provider.refund(transactionId, amount)
4. If successful:
   - Update payment status to "refunded"
   - Return updated payment
5. If failed:
   - Return error
```

## Webhook Update Flow

```
1. Provider sends webhook to /webhooks/:provider
2. Validate webhook signature
3. Look up payment by provider + transactionId
4. CRITICAL: Verify payment.provider matches webhook provider
5. Update payment status
6. Return acknowledgment
```

## State Transitions

```
pending → processing → succeeded → refunded
   │           │           │
   │           │           └──────→ disputed
   │           │
   └───────────┴──────────────────→ failed
```

Allowed transitions:
- `pending` → `processing`, `failed`
- `processing` → `succeeded`, `failed`
- `succeeded` → `refunded`, `disputed`
