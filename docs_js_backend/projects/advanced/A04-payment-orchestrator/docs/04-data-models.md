# A04 Payment Orchestrator - Data Models

## Payment

Core entity representing a payment transaction.

```typescript
interface Payment {
  id: string;                    // UUID v4
  amount: number;                // Payment amount in smallest currency unit
  currency: string;              // 3-letter ISO code (USD, EUR, etc.)
  description: string;           // 1-500 characters
  status: PaymentStatus;         // Current status
  provider: ProviderType | null; // Which provider processed the payment
  providerTransactionId: string | null; // Provider's transaction reference
  idempotencyKey: string;        // Deduplication key
  customerEmail: string;         // Customer email address
  metadata: Record<string, string>; // Custom key-value pairs
  attempts: PaymentAttempt[];    // Provider attempt history
  createdAt: Date;               // Creation timestamp
  updatedAt: Date;               // Last update timestamp
  reconciledAt: Date | null;     // Last reconciliation timestamp
}
```

## PaymentStatus

```typescript
type PaymentStatus =
  | 'pending'      // Initial state
  | 'processing'   // Being processed by provider
  | 'succeeded'    // Successfully charged
  | 'failed'       // All providers failed
  | 'refunded'     // Refund issued
  | 'disputed';    // Under dispute
```

## ProviderType

```typescript
type ProviderType = 'stripe' | 'paypal';
```

## PaymentAttempt

Records each provider attempt for audit trail.

```typescript
interface PaymentAttempt {
  provider: ProviderType;
  status: 'success' | 'failed';
  errorMessage?: string;
  timestamp: Date;
}
```

## CreatePaymentRequest

```typescript
interface CreatePaymentRequest {
  amount: number;
  currency: string;
  description: string;
  customerEmail: string;
  idempotencyKey?: string;       // Client-provided deduplication key
  metadata?: Record<string, string>;
}
```

## WebhookPayload

```typescript
interface WebhookPayload {
  provider: ProviderType;
  eventType: string;             // Provider-specific event type
  transactionId: string;         // Provider's transaction ID
  status: PaymentStatus;         // New status
  metadata: Record<string, unknown>;
}
```

## ReconciliationReport

```typescript
interface ReconciliationReport {
  date: string;                  // YYYY-MM-DD
  totalPayments: number;
  matched: number;               // Status matches provider
  unmatched: number;             // Status mismatch or missing
  discrepancies: Array<{
    paymentId: string;
    expectedStatus: PaymentStatus;
    actualStatus: PaymentStatus;
    provider: ProviderType;
  }>;
}
```

## Storage Implementation

### PaymentStore
- In-memory `Map<string, Payment>`
- Secondary index: `Map<string, string>` (idempotencyKey → paymentId)
- Lookup by provider + transactionId for webhook handling

### Provider Transaction Stores
- Each provider maintains its own `Map<string, Transaction>`
- Enables reconciliation between internal and provider state
