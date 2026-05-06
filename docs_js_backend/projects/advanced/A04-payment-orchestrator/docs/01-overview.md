# A04 Payment Orchestrator - Overview

## Project Description

A04 is a payment orchestration service built with Express 5, TypeScript, and ESM. It routes payments to multiple providers (Stripe, PayPal), implements fallback strategies, handles webhooks, and performs daily reconciliation.

## Key Features

- **Multi-Provider Routing**: Stripe (primary) and PayPal (fallback)
- **Circuit Breaker**: Prevents cascading failures when a provider is down
- **Idempotency**: Duplicate requests with same key return original payment
- **Webhook Handling**: Secure webhook endpoints for both providers
- **Reconciliation**: Daily comparison of internal vs provider records

## Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Express 5
- **Language**: TypeScript (ESM)
- **Testing**: Vitest + Supertest
- **Validation**: Zod

## Quick Start

```bash
npm install
npm run dev
```

## API Endpoints

- `GET /health` - Health check
- `POST /payments` - Create a payment
- `GET /payments/:id` - Get payment details
- `GET /payments/status/:status` - List payments by status
- `POST /payments/:id/refund` - Refund a payment
- `GET /providers/status` - Provider circuit breaker status
- `POST /webhooks/stripe` - Stripe webhook handler
- `POST /webhooks/paypal` - PayPal webhook handler
- `POST /reconcile` - Run reconciliation

## Design Principles

1. **Resilience**: Fallback to secondary provider if primary fails
2. **Consistency**: Idempotency prevents duplicate charges
3. **Security**: Webhook signatures verified per provider
4. **Isolation**: Cross-contamination prevention between providers
5. **Type Safety**: Full TypeScript coverage with strict mode
