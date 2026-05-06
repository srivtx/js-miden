# Dunning Management

## What Is Dunning?
**Dunning** is the process of recovering failed payments through automated retries, emails, and escalation.

## The Dunning Funnel

```
100%  ┌────────────────────────────────────────┐
      │  Invoice created                       │
      │  (payment due)                         │
 80%  ├────────────────────────────────────────┤
      │  Payment attempt #1 (immediately)      │
      │  → Success or failure                  │
 60%  ├────────────────────────────────────────┤
      │  Day 1: Retry + email notification     │
      │  → ~20% recover                        │
 45%  ├────────────────────────────────────────┤
      │  Day 3: Retry + "update card" email    │
      │  → ~15% recover                        │
 35%  ├────────────────────────────────────────┤
      │  Day 7: Retry + final notice           │
      │  → ~10% recover                        │
 25%  ├────────────────────────────────────────┤
      │  Day 14: Cancel subscription           │
      │  → Churn                               │
  0%  └────────────────────────────────────────┘
```

## Dunning Email Sequence

| Day | Email Subject | Content |
|---|---|---|
| 0 (immediate) | "Payment failed -- please update your card" | Explain the failure, provide update link |
| 1 | "We couldn't process your payment" | Retry scheduled, update card to avoid interruption |
| 3 | "Your subscription is at risk" | Service will be paused; update card now |
| 7 | "Final notice: Update your payment method" | Last chance before cancellation |
| 14 | "Your subscription has been cancelled" | Account downgraded; reactivate anytime |

## Implementation

```typescript
interface DunningStep {
  daysAfterFailure: number;
  action: 'retry' | 'email' | 'cancel';
  emailTemplate?: string;
  retryCount?: number;
}

const DUNNING_STEPS: DunningStep[] = [
  { daysAfterFailure: 0, action: 'retry', retryCount: 1 },
  { daysAfterFailure: 1, action: 'email', emailTemplate: 'payment_failed' },
  { daysAfterFailure: 3, action: 'retry', retryCount: 2 },
  { daysAfterFailure: 3, action: 'email', emailTemplate: 'update_card' },
  { daysAfterFailure: 7, action: 'retry', retryCount: 3 },
  { daysAfterFailure: 7, action: 'email', emailTemplate: 'final_notice' },
  { daysAfterFailure: 14, action: 'cancel' },
  { daysAfterFailure: 14, action: 'email', emailTemplate: 'subscription_cancelled' },
];

async function handlePaymentFailed(subscriptionId: string) {
  await db.dunningRun.create({
    data: {
      subscriptionId,
      status: 'ACTIVE',
      startedAt: new Date(),
    },
  });

  for (const step of DUNNING_STEPS) {
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + step.daysAfterFailure);

    await db.dunningJob.create({
      data: {
        subscriptionId,
        scheduledAt,
        action: step.action,
        emailTemplate: step.emailTemplate,
        retryCount: step.retryCount,
      },
    });
  }
}
```

## Dunning Job Processor

```typescript
import { Queue } from 'bullmq';

const dunningQueue = new Queue('dunning', { connection: redis });

// Cron job runs every hour
async function processDunningJobs() {
  const jobs = await db.dunningJob.findMany({
    where: {
      scheduledAt: { lte: new Date() },
      completedAt: null,
    },
    take: 100,
  });

  for (const job of jobs) {
    await dunningQueue.add('process', { jobId: job.id });
  }
}

// Worker
async function processDunningJob(jobId: string) {
  const job = await db.dunningJob.findUnique({ where: { id: jobId } });
  const subscription = await db.subscription.findUnique({
    where: { id: job.subscriptionId },
  });

  if (subscription.status !== 'PAST_DUE') {
    await db.dunningJob.update({
      where: { id: jobId },
      data: { completedAt: new Date(), result: 'skipped_not_past_due' },
    });
    return;
  }

  switch (job.action) {
    case 'retry':
      await retryPayment(subscription);
      break;
    case 'email':
      await sendEmail(subscription.userId, job.emailTemplate!);
      break;
    case 'cancel':
      await cancelSubscription(subscription);
      break;
  }

  await db.dunningJob.update({
    where: { id: jobId },
    data: { completedAt: new Date() },
  });
}
```

## Metrics to Track

| Metric | Target | Action if Low |
|---|---|---|
| Recovery rate (Day 1) | > 20% | Improve email copy |
| Recovery rate (Day 3) | > 15% | Add in-app notification |
| Recovery rate (Day 7) | > 10% | Offer discount |
| Final churn rate | < 25% | Review pricing |

## OWASP Reference

> "Implement rate limiting and backoff for automated retry systems to avoid overwhelming downstream services." -- OWASP Resilience Cheat Sheet
