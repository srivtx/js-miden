# 05 - Billing Service

## WHAT

The Billing Service calculates charges based on usage and subscription tiers. It generates invoices, tracks payment status, and handles webhook notifications for billing events.

**Responsibilities:**
- Define subscription tiers (requests per month, price, overage rate)
- Calculate monthly invoices from usage aggregates
- Apply base price + overage pricing
- Track invoice status (pending, paid, failed)
- Trigger webhooks for invoice generation and payment events

## WHY

### Why Decouple Billing from Usage?

Billing is a batch process. Usage is real-time. Decoupling allows:
- Usage tracking to remain fast (no complex calculations per request)
- Billing to be recalculated if pricing changes retroactively
- Different billing cycles (monthly, annual, usage-based)
- Graceful degradation (if billing is down, APIs still work)

### Why Tier-Based Pricing?

Tiers simplify the consumer decision:
- **Free:** 1,000 req/month (acquisition)
- **Basic:** 10,000 req/month at $9.99 (individual developers)
- **Pro:** 50,000 req/month at $49.99 (small teams)
- **Enterprise:** 1M req/month at $499.99 (custom SLA)

Tiers also reduce the cognitive load compared to pure pay-per-request pricing.

## HOW

### Invoice Calculation

```typescript
function calculateInvoice(
  tier: SubscriptionTier,
  totalRequests: number
): Invoice {
  const overageRequests = Math.max(0, totalRequests - tier.requestsPerMonth);
  const baseAmount = tier.pricePerMonth;
  const overageAmount = overageRequests * tier.overagePricePerRequest;
  
  return {
    baseAmount,      // Fixed monthly fee
    overageAmount,   // Variable based on usage
    totalAmount: baseAmount + overageAmount,
    // ...
  };
}
```

### Billing Cycle

1. **1st of month:** Generate invoices for previous month
2. **3rd of month:** Charge payment method
3. **5th of month:** Retry failed payments
4. **10th of month:** Suspend keys for unpaid invoices
5. **Anytime:** Trigger threshold alerts at 80%, 90%, 100% of quota

### Webhook Events

```typescript
interface BillingWebhook {
  event: 'invoice.created' | 'invoice.paid' | 'invoice.failed' | 'threshold.reached';
  data: {
    invoiceId?: string;
    apiKeyId: string;
    amount?: number;
    usagePercent?: number;
  };
}
```

## WRONG vs RIGHT

### WRONG: Calculating Billing Per Request

```typescript
// WRONG: Charging on every request
app.post('/track', async (req, res) => {
  await recordUsage(req);
  
  // DON'T do this - adds latency to every API call
  const cost = calculateIncrementalCost(req);
  await chargeAccount(req.apiKeyId, cost);
  
  res.json({ recorded: true });
});
```

**Why Wrong:** Adds 50-200ms to every request. Payment gateway outages break API access. Creates hundreds of tiny charges instead of one monthly invoice.

### RIGHT: Monthly Batch Billing

```typescript
// RIGHT: Aggregate all month, bill once
// Usage Service tracks daily
// Billing Service runs a cron job on the 1st:

async function generateMonthlyInvoices(year: number, month: number) {
  const aggregates = await usageService.getMonthlyAggregates(year, month);
  
  for (const aggregate of aggregates) {
    const tier = await getTier(aggregate.tierId);
    const invoice = calculateInvoice(tier, aggregate.totalRequests);
    
    await saveInvoice(invoice);
    await triggerWebhook(aggregate.developerId, 'invoice.created', invoice);
  }
}

// Run via node-cron at 00:00 on the 1st
cron.schedule('0 0 1 * *', () => generateMonthlyInvoices(...));
```

**Why Right:** One charge per month per subscription. API latency unaffected. Can be retried if payment fails. Consumers get predictable invoices.

### WRONG: Storing Prices as Floating Point

```typescript
// WRONG: Using JavaScript numbers for money
const price = 9.99;
const overage = 0.001;
const total = price + (overage * 1500); // 9.99 + 1.5 = 11.490000000000002 (!)
```

**Why Wrong:** JavaScript floating point arithmetic produces rounding errors. Financial calculations must be exact.

### RIGHT: Integer Cents

```typescript
// RIGHT: Store everything in cents (smallest currency unit)
interface SubscriptionTier {
  pricePerMonthCents: number;        // 999 instead of 9.99
  overagePricePerRequestCents: number; // 0.1 cents instead of 0.001
}

function calculateInvoice(tier, totalRequests) {
  const overageRequests = Math.max(0, totalRequests - tier.requestsPerMonth);
  const baseAmountCents = tier.pricePerMonthCents;
  const overageAmountCents = overageRequests * tier.overagePricePerRequestCents;
  
  return {
    baseAmountCents,
    overageAmountCents,
    totalAmountCents: baseAmountCents + overageAmountCents
    // Format to dollars only for display
  };
}
```

**Why Right:** Integer arithmetic is exact. No floating point errors. Currency formatting is a presentation-layer concern.

### WRONG: No Idempotency on Invoice Generation

```typescript
// WRONG: Can generate duplicate invoices
async function generateInvoice(apiKeyId, year, month) {
  const usage = await getUsage(apiKeyId, year, month);
  const invoice = calculateInvoice(usage);
  await db.insert('invoices', invoice); // Might insert twice!
}
```

**Why Wrong:** If the cron job runs twice (deployment, retry, split-brain), consumers get double-billed.

### RIGHT: Idempotent Invoice Generation

```typescript
// RIGHT: Use deterministic invoice ID
async function generateInvoice(apiKeyId, year, month) {
  const invoiceId = `inv_${apiKeyId}_${year}_${month}`; // Deterministic!
  
  // UPSERT instead of INSERT
  await db.query(`
    INSERT INTO invoices (id, api_key_id, year, month, amount, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
    ON CONFLICT (id) DO NOTHING
  `, [invoiceId, apiKeyId, year, month, amount]);
  
  return await db.findInvoice(invoiceId);
}
```

**Why Right:** Running the billing job N times produces the same result as running it once. Invoice ID is deterministic based on subscription + period.

### WRONG: Synchronous Webhook Delivery

```typescript
// WRONG: Waiting for webhook during invoice generation
for (const invoice of invoices) {
  await generateInvoice(invoice);
  await sendWebhook(invoice.developerId, 'invoice.created', invoice);
  // If webhook is slow, entire batch is slow
  // If webhook fails, invoice generation stops
}
```

**Why Wrong:** Webhook latency (1-5 seconds typical) blocks the entire billing batch. One failing webhook endpoint breaks billing for everyone after it.

### RIGHT: Async Webhook Queue

```typescript
// RIGHT: Queue webhooks, process independently
for (const invoice of invoices) {
  await generateInvoice(invoice);
  await webhookQueue.publish({
    event: 'invoice.created',
    developerId: invoice.developerId,
    payload: invoice
  });
}

// Separate worker processes webhooks with retry
async function processWebhookJob(job) {
  const webhook = await getWebhook(job.developerId, job.event);
  if (!webhook) return;
  
  try {
    await sendWebhookWithRetry(webhook, job.payload);
    await markDelivered(job.id);
  } catch (err) {
    if (job.attempts < 5) {
      await requeueWithBackoff(job);
    } else {
      await markDeadLetter(job.id);
    }
  }
}
```

**Why Right:** Invoice generation completes in seconds regardless of webhook latency. Failed webhooks retry independently. No single developer's broken endpoint affects others.
