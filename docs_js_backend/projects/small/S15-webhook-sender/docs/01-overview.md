# Overview

S15 Webhook Sender registers webhook URLs and reliably delivers events with retries, exponential backoff, and delivery logging.

## Goals

- Register webhook subscriptions with event type filtering
- Deliver POST requests to subscribed URLs
- Retry failed deliveries with exponential backoff
- Log every delivery attempt for observability
- Demonstrate common webhook bugs for educational purposes

## Tech Stack

- Express 5 with TypeScript (ESM)
- PostgreSQL for persistence
- node-fetch for HTTP delivery
- Vitest + Supertest for testing

## Key Concepts

- **At-least-once delivery**: Events may be delivered multiple times; receivers must be idempotent
- **Exponential backoff**: Delays increase between retries (1s, 2s, 4s, 8s...)
- **Payload signing**: HMAC-SHA256 signature lets receivers verify sender identity
