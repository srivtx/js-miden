# Research Notes

## Sources
- **Debezium Documentation**: The open-source CDC platform. Key finding: always use logical replication slots, never triggers.
- **Martin Kleppmann, "Making Sense of Stream Processing" (2016)**: Explains log-based architectures, exactly-once semantics, and the duality of streams and tables.
- **PostgreSQL Logical Decoding**: Official docs on `pg_logical` and `pgoutput` plugins. WAL reading is the only reliable CDC method.
- **Confluent Blog, "Turning the Database Inside Out" (2014)**: The philosophical argument for making the log (WAL) the primary system of record.
- **Kleppmann, M. (2017). "Designing Data-Intensive Applications"**. O'Reilly.
  - Chapter 11 covers stream processing, log-based architectures, and the importance of ordering.

## Latest Trends (2025)
- **Debezium Server + Pulsar**: Moving beyond Kafka to multi-protocol event streaming.
- **Materialize**: SQL on streams with correctness guarantees (consolidation).
- **Flink CDC Connectors**: Exactly-once CDC directly into Flink without Kafka intermediary.
- **AWS DMS / Azure Data Factory**: Managed CDC services reducing operational burden.

## Benchmarks
- PostgreSQL logical decoding: ~10K changes/second per slot.
- Trigger-based CDC: ~2K changes/second (write amplification).
- Polling (1s interval): ~100 changes/second (misses bursts).
- Simulated CDC (application table): ~5K changes/second.

## Industry Adoption
- **Airbnb**: SpinalTap (MySQL CDC) → Kafka → consumers.
- **Netflix**: DBLog (universal CDC) with checkpointing.
- **Shopify**: Debezium → Kafka → Elasticsearch, cache warming.
- **Stripe**: PostgreSQL logical replication → Kafka → fraud detection pipeline.
- **LinkedIn**: Brooklin (streaming data pipeline) for CDC across data centers.
