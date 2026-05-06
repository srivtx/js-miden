# MD06 Billing Engine — Project Overview

## Goal
Build a billing engine that handles subscription lifecycle, payment processing, invoicing, dunning, and webhook security, with idempotency guarantees and PCI compliance.

## Why This Matters
- **Money is sensitive**: A single double-charge can destroy customer trust
- **Compliance**: PCI-DSS is legally required for cardholder data handling
- **Complexity**: Subscriptions have states (trial, active, past_due, cancelled), proration, upgrades, downgrades

## Architecture

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Client    │─────▶│  Billing API    │─────▶│  Payment        │
│  (Frontend) │      │  (Node.js)      │      │  Gateway        │
└─────────────┘      │                 │      │  (Stripe /      │
                     │  - Subscriptions│      │   Adyen)        │
                     │  - Invoicing    │      └─────────────────┘
                     │  - Dunning      │               │
                     │  - Webhooks     │               │
                     └────────┬────────┘               │
                              │                        │
                              ▼                        ▼
                     ┌─────────────────┐      ┌─────────────────┐
                     │  PostgreSQL     │      │  Webhook        │
                     │  (subscriptions,│      │  Endpoint       │
                     │   invoices,     │      │  (HMAC verify)  │
                     │   idempotency)  │      └─────────────────┘
                     └─────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  Redis          │
                     │  (idempotency   │
                     │   keys, rate    │
                     │   limiting)     │
                     └─────────────────┘
```

## Core Modules
1. **Subscription Service** (`src/services/subscriptionService.ts`) — lifecycle, state machine
2. **Billing Service** (`src/services/billingService.ts`) — invoicing, proration
3. **Stripe Utils** (`src/utils/stripe.ts`) — payment gateway abstraction
4. **Idempotency Utils** (`src/utils/idempotency.ts`) — deduplication
5. **Webhook Handler** (`src/routes/webhooks.ts`) — event ingestion, HMAC verification

## Key Concepts
- **Payment processing**: Charging cards, handling failures
- **Webhook security**: Verifying events came from the payment provider
- **Idempotency**: Preventing double-charges on retries
- **State machines**: Subscription lifecycle management
- **Retry logic**: Exponential backoff for failed operations
- **Dunning**: Recovering failed payments
- **PCI compliance**: Secure handling of cardholder data

## Tech Stack
- Node.js + Express / Fastify
- Prisma + PostgreSQL
- Stripe SDK
- Redis (idempotency, rate limiting)
- Vitest (testing)

## Checklist
- [ ] No cardholder data (PAN, CVV) stored in the application database
- [ ] All charges are idempotent
- [ ] Webhooks are verified with HMAC before processing
- [ ] Subscription state machine is explicit and tested
- [ ] Dunning retries are capped and do not harass customers
- [ ] PCI-DSS SAQ A compliance is documented
