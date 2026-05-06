# The Problem

## What Are We Building?
An e-commerce order management system using Event Sourcing and CQRS. Every state change (order placed, order cancelled) is stored as an immutable event. Reads and writes are separated: commands write to the event store; queries read from optimized projections.

## Why Does This Problem Exist?
Traditional CRUD systems lose history. When an order is "updated", the old state is overwritten. For audit trails, compliance (SOX, GDPR), and debugging, you need to know *what changed* and *when*. Event sourcing makes the log the source of truth.

CQRS solves a second problem: the data model optimized for writes (normalized, transactional) is terrible for reads (denormalized, filtered, sorted). By separating read and write models, each can be optimized independently.

## Who Will Use It?
- **Customers**: Place orders, cancel orders.
- **Customer Support**: Replay an order's history to resolve disputes.
- **Auditors**: Verify that no order was modified without a recorded reason.
- **BI Teams**: Project events into analytics models.

## Constraints
- **Durability**: Events must survive crashes. Append-only, no deletes.
- **Consistency**: Read model is eventually consistent (projection lag < 1s).
- **Scalability**: Read model can be scaled independently of write model.
- **Auditability**: Every state change has a timestamp, reason, and actor.

## What We're NOT Building
- We are NOT building a full EventStoreDB replacement (no clustering, no catch-up subscriptions).
- We are NOT building saga orchestration (no distributed transactions across aggregates).
- We are NOT building a generic event bus (no Kafka, no RabbitMQ).
