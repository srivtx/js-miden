# A04 Payment Orchestrator - Provider Abstraction

## PaymentProvider Interface

All payment providers implement this interface:

```typescript
interface PaymentProvider {
  readonly name: ProviderType;
  
  // Charge a payment
  charge(request: ProviderChargeRequest): Promise<ProviderChargeResult>;
  
  // Refund a transaction
  refund(transactionId: string, amount: number): Promise<ProviderChargeResult>;
  
  // Get current transaction status
  getTransactionStatus(transactionId: string): Promise<PaymentStatus>;
  
  // Verify webhook authenticity
  verifyWebhook(payload: unknown, signature: string): boolean;
}
```

## Stripe Provider

### Mock Implementation

The `StripeProvider` simulates Stripe's API with configurable failure rates:

```typescript
class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private failureRate = 0;
  
  setFailureRate(rate: number): void {
    this.failureRate = rate; // 0.0 to 1.0
  }
  
  async charge(request: ProviderChargeRequest): Promise<ProviderChargeResult> {
    if (Math.random() < this.failureRate) {
      return { success: false, error: 'Card declined' };
    }
    return { success: true, transactionId: generateStripeId() };
  }
}
```

### Signature Verification

Stripe webhooks include a signature header:

```typescript
verifyWebhook(payload: unknown, signature: string): boolean {
  if (!signature.startsWith('stripe_')) return false;
  const expected = computeSignature(payload);
  return signature === expected;
}
```

## PayPal Provider

### Mock Implementation

Similar to Stripe but with different latency and error messages:

```typescript
class PayPalProvider implements PaymentProvider {
  readonly name = 'paypal';
  private failureRate = 0;
  
  async charge(request: ProviderChargeRequest): Promise<ProviderChargeResult> {
    if (Math.random() < this.failureRate) {
      return { success: false, error: 'Insufficient funds' };
    }
    return { success: true, transactionId: generatePayPalId() };
  }
}
```

### Signature Verification

PayPal uses a different signature format:

```typescript
verifyWebhook(payload: unknown, signature: string): boolean {
  if (!signature.startsWith('paypal_')) return false;
  const expected = computeSignature(payload);
  return signature === expected;
}
```

## Adding a New Provider

To add a new provider (e.g., Square):

1. Create `src/providers/square.ts`:
```typescript
export class SquareProvider implements PaymentProvider {
  readonly name = 'square' as ProviderType;
  
  async charge(request: ProviderChargeRequest): Promise<ProviderChargeResult> {
    // Implementation
  }
  
  async refund(transactionId: string, amount: number): Promise<ProviderChargeResult> {
    // Implementation
  }
  
  async getTransactionStatus(transactionId: string): Promise<PaymentStatus> {
    // Implementation
  }
  
  verifyWebhook(payload: unknown, signature: string): boolean {
    // Implementation
  }
}
```

2. Register in `app.ts`:
```typescript
const squareProvider = new SquareProvider();
const providers = [stripeProvider, paypalProvider, squareProvider];
```

3. Update `ProviderType`:
```typescript
type ProviderType = 'stripe' | 'paypal' | 'square';
```

## Provider Selection Strategy

### Current Implementation

Primary provider is configured via environment variable:

```typescript
const PRIMARY_PROVIDER = config.PRIMARY_PROVIDER; // 'stripe' or 'paypal'

function sortProvidersByPriority(): PaymentProvider[] {
  return providers.sort((a, b) => {
    if (a.name === PRIMARY_PROVIDER) return -1;
    if (b.name === PRIMARY_PROVIDER) return 1;
    return 0;
  });
}
```

### Future Enhancements

1. **Cost-Based Routing**: Route to cheapest provider
2. **Geographic Routing**: Route based on customer location
3. **Success-Rate Routing**: Route to provider with highest success rate
4. **Load Balancing**: Distribute across providers
