# Research Notes

## Sources
- **Fowler, M. (2005). "Event Sourcing"**. martinfowler.com.
  - The original article defining event sourcing. Key insight: "The fundamental idea of Event Sourcing is to ensure that every change to the state of an application is captured in an event object."
- **Young, G. (2010). "CQRS, Task Based UIs, Event Sourcing agh!"**. CodeBetter blog.
  - Greg Young's seminal post arguing that CQRS is not a top-level architecture but a pattern for specific boundaries.
- **Vernon, V. (2013). "Implementing Domain-Driven Design"**. Addison-Wesley.
  - Chapters on aggregates, domain events, and event stores. The "Aggregate Design Rules" (transaction boundary, small clusters) are critical.
- **Microsoft Patterns & Practices (2013). "Exploring CQRS and Event Sourcing"**. MSDN.
  - Practical guide with .NET examples. Covers projections, snapshots, and read model rebuilds.
- **Betts, D., et al. (2013). "Exploring CQRS and Event Sourcing"**. Microsoft.
  - Reference architecture for CQRS with event sourcing. Discusses sagas, process managers, and idempotency.
- **Kleppmann, M. (2017). "Designing Data-Intensive Applications"**. O'Reilly.
  - Chapter 11: Stream Processing. Discusses event sourcing as a form of stream processing.
- **Newman, S. (2021). "Building Microservices"**. O'Reilly.
  - Chapter on data ownership. Event sourcing as a way to maintain data consistency across services.

## Latest Trends (2025)
- **EventStoreDB v23+**: Cloud-native deployment, gRPC interface, catch-up subscriptions with filtering.
- **Axon Framework**: Java-centric but influential. Event sourcing + CQRS + Saga orchestration.
- **Temporal / Cadence**: Workflow engines that complement event sourcing for long-running processes.
- **Change Data Capture (CDC)**: Database logs as event streams. Bridges CRUD and event sourcing.
- **Event Sourcing in Serverless**: AWS Lambda processing DynamoDB Streams or Kinesis. Stateless consumers, durable log.

## Benchmarks
- PostgreSQL append-only insert: ~10K events/second (single instance, SSD).
- Event replay (no snapshot): ~5K events/second.
- Event replay (with snapshot every 100 events): ~50K events/second.
- Read model projection: ~2K aggregates/second.
- Snapshot storage overhead: ~1% of event store size.

## Industry Adoption
- **Shopify**: Uses event sourcing for order workflows. Event store is PostgreSQL; projections feed Elasticsearch and Redis.
- **Netflix**: "Chaos Monkey" and "Conductor" use event logs for workflow state. Snapshots in S3.
- **Klarna**: Event-sourced payment flows. Read models in Cassandra, event store in Kafka.
- **Walmart**: Inventory management with event sourcing. Projections to multiple read models (search, analytics, mobile).
- **Zalando**: "Eventuate" framework. Event store in PostgreSQL, CDC to Kafka for cross-service distribution.
