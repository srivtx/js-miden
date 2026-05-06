# The Problem

## What Are We Building?
A Change Data Capture (CDC) pipeline that turns every INSERT, UPDATE, and DELETE in PostgreSQL into an event that downstream consumers can react to.

## Why Does This Problem Exist?
Modern backends have many caches, search indexes, and notification systems. Keeping them in sync with the primary database is hard. CDC solves this by making the database the single source of truth and broadcasting changes.

## Who Will Use It?
- **Cache Layer**: Invalidate or warm cache entries when rows change.
- **Search Index**: Update Elasticsearch/OpenSearch documents.
- **Notification Service**: Send emails when order status changes.
- **Analytics**: Stream changes to a data warehouse.

## Constraints
- **Time**: Events must be published within 100ms of the commit.
- **Scale**: Handle 1K+ changes/second.
- **Correctness**: No missed changes, no out-of-order delivery.
- **Durability**: Consumer offsets must survive crashes.

## What We're NOT Building
- We are NOT building a full Debezium replacement (no Kafka, no schema registry).
- We are NOT building bi-directional sync (only DB → consumers).
- We are NOT building a GUI for CDC configuration.
