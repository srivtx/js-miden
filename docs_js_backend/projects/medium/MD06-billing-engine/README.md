# MD06: SaaS Billing Engine

A subscription billing engine integrating with Stripe, featuring webhook handling, idempotency, subscription state machines, proration, and failed payment recovery (dunning).

## Features

- **Subscription Management**: Create, update, cancel subscriptions via Stripe
- **Webhook Handling**: Secure webhook processing with signature verification
- **Idempotency**: Prevent double-processing of payments and events
- **State Machine**: Proper subscription lifecycle (incomplete → active → past_due → canceled)
- **Proration**: Handle upgrades/downgrades with prorated charges
- **Dunning**: Retry failed payments with configurable intervals

## Thinking Framework

### PHASE 1: Core Implementation

1. **Subscription Creation**:
   - User selects plan
   - Create Stripe customer if needed
   - Create Stripe subscription with payment method
   - Store subscription record with idempotency key
   - Handle `invoice.payment_succeeded` webhook

2. **Webhook Processing**:
   - Receive Stripe webhooks at `/webhooks/stripe`
   - Verify webhook signature with secret
   - Extract idempotency key from event
   - Check if event already processed (deduplication)
   - Process event and update subscription state

3. **State Machine**:
   - States: INCOMPLETE → TRIALING/ACTIVE → PAST_DUE → CANCELED/UNPAID
   - Transitions triggered by webhooks
   - Idempotent state updates (same event processed multiple times = same state)

4. **Proration**:
   - On upgrade: Stripe prorates automatically with `proration_behavior: 'create_prorations'`
   - On downgrade: Schedule at period end or prorate immediately
   - Track proration invoices separately

5. **Dunning (Failed Payments)**:
   - On `invoice.payment_failed`, mark subscription PAST_DUE
   - Schedule retry attempts (exponential backoff)
   - After max retries, cancel subscription
   - Notify user at each retry

### PHASE 2: Architecture Decisions

**Webhook Security**:
- Must verify Stripe signature before processing
- Use `stripe.webhooks.constructEvent()` with webhook secret
- Reject unverified webhooks with 400
- Log all webhooks (verified and unverified) for audit

**Idempotency**:
- Idempotency key on all write operations
- Stripe events use `id` field as natural idempotency key
- Store processed event IDs in database
- Return 200 for duplicate events (don't error - Stripe retries on error)

**State Management**:
- PostgreSQL as source of truth for subscription state
- Stripe as payment processor, not state authority
- Reconcile state on each webhook to handle missed events
- State transitions validated against allowed transitions

**Race Condition Handling**:
- Use database transactions for subscription updates
- Row-level locking (`SELECT FOR UPDATE`) on subscription row
- Process webhooks sequentially per customer (Redis queue)

### PHASE 3: Advanced Considerations

- **Billing Portal**: Stripe Customer Portal integration
- **Invoicing**: Custom invoice generation for enterprise
- **Tax**: Tax calculation with TaxJar or Stripe Tax
- **Usage-Based Billing**: Metered billing with periodic usage reports
- **Multi-Currency**: Currency conversion and localized pricing
- **Grace Periods**: Soft limits during dunning before hard cancellation
- **Revenue Recognition**: ASC 606 / IFRS 15 compliant revenue tracking

## Tech Stack

- Express 5 with TypeScript (ESM)
- Prisma ORM with PostgreSQL
- Redis for idempotency cache and job queues
- Stripe SDK for payment processing
- JWT authentication

## Bug Introduction

### Bug 1: No Webhook Signature Verification
**Location**: `src/routes/webhooks.ts` - `POST /webhooks/stripe` handler
**Issue**: Webhook handler processes the request body directly without verifying Stripe signature. Anyone can POST fake webhook events.
**Impact**: Attackers can fake payment events, activate subscriptions without paying, or cancel legitimate subscriptions.

### Bug 2: No Idempotency on Payment Processing
**Location**: `src/services/subscriptionService.ts` - `processPayment` function
**Issue**: Does not check if invoice has already been processed before recording payment. Stripe may send duplicate webhooks.
**Impact**: Double-counting payments, duplicate invoice records, incorrect subscription state.

### Bug 3: Race Condition in Subscription Update
**Location**: `src/services/subscriptionService.ts` - `updateSubscriptionStatus`
**Issue**: No database transaction or locking when updating subscription from webhook. Two simultaneous webhooks for same subscription can interleave.
**Impact**: Lost updates, inconsistent state (e.g., subscription shows ACTIVE when it should be CANCELED).

## Running the Project

```bash
# Start dependencies
docker-compose up -d

# Copy env and install
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate

# Run with bugs
npm run dev

# Run tests
npm test
```

## API Endpoints

### Public
- `POST /webhooks/stripe` - Stripe webhook endpoint

### Authenticated
- `POST /api/subscriptions` - Create subscription
- `GET /api/subscriptions` - List user subscriptions
- `GET /api/subscriptions/:id` - Get subscription details
- `POST /api/subscriptions/:id/upgrade` - Upgrade plan (prorated)
- `POST /api/subscriptions/:id/downgrade` - Downgrade plan
- `POST /api/subscriptions/:id/cancel` - Cancel subscription
- `GET /api/invoices` - List invoices
- `POST /api/payment-methods` - Add payment method
- `GET /api/payment-methods` - List payment methods

## Webhook Events Handled

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.created`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

## Project Structure

```
src/
├── index.ts              # Entry point
├── config/               # Configuration
├── routes/
│   ├── auth.ts          # Authentication routes
│   ├── subscriptions.ts # Subscription routes
│   ├── invoices.ts      # Invoice routes
│   └── webhooks.ts      # Stripe webhook handler
├── middleware/
│   ├── auth.ts          # JWT auth middleware
│   └── errorHandler.ts  # Global error handler
├── services/
│   ├── subscriptionService.ts # Subscription CRUD + state machine
│   ├── billingService.ts      # Stripe integration
│   └── invoiceService.ts      # Invoice processing
├── utils/
│   ├── stripe.ts        # Stripe client setup
│   └── idempotency.ts   # Idempotency key utilities
└── types/
    └── index.ts         # TypeScript types
```
