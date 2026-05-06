# A04 Payment Orchestrator - Architecture

## System Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Client    │────▶│   Express    │────▶│   Controllers   │
│             │◀────│    Server    │◀────│                 │
└─────────────┘     └──────────────┘     └─────────────────┘
                                                  │
                          ┌───────────────────────┘
                          ▼
                   ┌──────────────┐
                   │   Services   │
                   │  - Payment   │
                   │  - Reconcile │
                   └──────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
      ┌──────────────┐       ┌──────────────┐
      │  Provider    │       │  Payment     │
      │  Abstraction │       │  Store       │
      └──────────────┘       └──────────────┘
              │
      ┌───────┴───────┐
      ▼               ▼
┌──────────┐   ┌──────────┐
│  Stripe  │   │  PayPal  │
│  (Mock)  │   │  (Mock)  │
└──────────┘   └──────────┘
```

## Component Responsibilities

### Controllers
- **PaymentController**: CRUD operations for payments
- **WebhookController**: Handles provider webhooks with signature verification
- **ReconciliationController**: Triggers reconciliation jobs

### Services
- **PaymentService**: Orchestrates payment flow with fallback and idempotency
- **ReconciliationService**: Compares internal records with provider records

### Models
- **PaymentStore**: In-memory storage with idempotency key index
- **Provider Transaction Maps**: Each provider tracks its own transactions

### Providers
- **PaymentProvider Interface**: Abstraction for provider implementations
- **StripeProvider**: Mock Stripe integration with configurable failure rate
- **PayPalProvider**: Mock PayPal integration with configurable failure rate

### Utils
- **CircuitBreaker**: Fault tolerance pattern implementation

## Concurrency & Resilience

### Circuit Breaker States

```
  ┌─────────┐
  │  CLOSED │ ◀── Normal operation, requests pass through
  └────┬────┘
       │ Failure threshold reached
       ▼
  ┌─────────┐
  │  OPEN   │ ◀── Requests fail fast, no calls to provider
  └────┬────┘
       │ Timeout elapsed
       ▼
  ┌─────────┐
  │HALF-OPEN│ ◀── Limited requests allowed to test provider
  └────┬────┘
       │ Success threshold reached
       ▼
  ┌─────────┐
  │  CLOSED │
  └─────────┘
```

### Idempotency Flow

```
Client Request
     │
     ▼
┌─────────────┐
│ Check       │
│ Idempotency │
│ Key         │
└──────┬──────┘
       │
   ┌───┴───┐
   ▼       ▼
 Exists   New
   │       │
   ▼       ▼
 Return  Create
 Existing Payment
 Payment
```

## Data Flow

### Payment Creation Flow
1. Client POSTs payment request to `/payments`
2. Controller validates input
3. Service checks idempotency key
4. Service attempts primary provider (Stripe)
5. If primary fails, service falls back to secondary (PayPal)
6. Service records attempt history
7. Response returned with payment details

### Webhook Flow
1. Provider sends webhook to `/webhooks/:provider`
2. Controller validates webhook signature
3. Service verifies payment belongs to the provider
4. Service updates payment status
5. Acknowledgment returned
