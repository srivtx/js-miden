# A04 Payment Orchestrator - Reconciliation

## Overview

Reconciliation compares internal payment records with provider records to detect discrepancies. This is critical because:

1. **Lost Webhooks**: Provider sent webhook but it never arrived
2. **Status Mismatches**: Internal status differs from provider status
3. **Missing Transactions**: Provider has record we don't have (or vice versa)

## Reconciliation Process

### Daily Reconciliation Flow

```
1. Select date range (start of day to end of day)
2. Fetch all internal payments for that date
3. For each payment:
   a. Skip if no provider or transactionId
   b. Query provider for current status
   c. Compare internal status with provider status
   d. If match: increment matched, update reconciledAt
   e. If mismatch: add to discrepancies
4. Generate reconciliation report
```

### Implementation

```typescript
async reconcileDate(date: Date): Promise<ReconciliationReport> {
  const payments = await paymentStore.getByDateRange(startOfDay, endOfDay);
  const discrepancies = [];
  let matched = 0;
  let unmatched = 0;

  for (const payment of payments) {
    const provider = providers.find(p => p.name === payment.provider);
    const providerStatus = await provider.getTransactionStatus(
      payment.providerTransactionId
    );

    if (statusesMatch(payment.status, providerStatus)) {
      matched++;
      payment.reconciledAt = new Date();
      await paymentStore.save(payment);
    } else {
      discrepancies.push({
        paymentId: payment.id,
        expectedStatus: payment.status,
        actualStatus: providerStatus,
        provider: payment.provider,
      });
      unmatched++;
    }
  }

  return { date, totalPayments: payments.length, matched, unmatched, discrepancies };
}
```

## Handling Discrepancies

### Types of Discrepancies

1. **Internal: succeeded, Provider: failed**
   - Possible cause: Webhook not received, timeout during processing
   - Action: Update internal status, notify customer

2. **Internal: pending, Provider: succeeded**
   - Possible cause: Webhook not received
   - Action: Update internal status to succeeded

3. **Internal: succeeded, Provider: refunded**
   - Possible cause: Refund webhook not received
   - Action: Update internal status, notify customer

### Automated Resolution

Future enhancement: Auto-resolve common discrepancies:

```typescript
function autoResolve(discrepancy: Discrepancy): boolean {
  if (discrepancy.expectedStatus === 'pending' && 
      discrepancy.actualStatus === 'succeeded') {
    // Update internal status to match provider
    return true;
  }
  // ... other rules
  return false;
}
```

## Scheduling

### Manual Trigger

```bash
curl -X POST http://localhost:3001/reconcile?date=2024-01-01
```

### Automated Schedule (Future)

```typescript
// Run reconciliation daily at 2 AM
schedule('0 2 * * *', async () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await reconciliationService.reconcileDate(yesterday);
});
```

## Reporting

### Reconciliation Report Format

```json
{
  "date": "2024-01-01",
  "totalPayments": 150,
  "matched": 148,
  "unmatched": 2,
  "discrepancies": [
    {
      "paymentId": "uuid-1",
      "expectedStatus": "succeeded",
      "actualStatus": "failed",
      "provider": "stripe"
    },
    {
      "paymentId": "uuid-2",
      "expectedStatus": "pending",
      "actualStatus": "succeeded",
      "provider": "paypal"
    }
  ]
}
```

### Metrics

Track over time:
- Reconciliation success rate
- Average discrepancy count per day
- Time to resolve discrepancies
- Provider with most discrepancies
