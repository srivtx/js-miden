# 07-RESEARCH.md

## Citations and References

### Foundational Papers

1. **Fowler, M. (2005). "Event Sourcing"**
   - Patterns of Enterprise Application Architecture (PoEAA), Addison-Wesley
   - https://martinfowler.com/eaaDev/EventSourcing.html
   - Establishes the core pattern: store events as the system of record, derive state by replay.

2. **Young, G. (2010). "CQRS, Task Based UIs, Event Sourcing agh!"**
   - Blog post defining CQRS + Event Sourcing as complementary patterns
   - https://cqrs.wordpress.com/documents/building-event-storage/
   - Introduces aggregate boundaries and event store requirements.

3. **Kleppmann, M. (2017). "Making Sense of Stream Processing"**
   - O'Reilly Media
   - Discusses log-based architectures, event sourcing at scale, and stream processing fundamentals.

### Event Store Implementations

4. **EventStoreDB Documentation**
   - Event Store Software Ltd.
   - https://developers.eventstore.com/
   - Reference implementation of an event store with streams, projections, and subscriptions.

5. **Apache Kafka as Event Store**
   - Kreps, J. (2013). "Kafka: a Distributed Messaging System for Log Processing"
   - NetDB Workshop
   - While not a pure event store, Kafka's log semantics align with event sourcing principles.

### Optimistic Concurrency Control

6. **Bernstein, P. A., & Goodman, N. (1981). "Concurrency Control in Distributed Database Systems"**
   - ACM Computing Surveys, 13(2), 185-221
   - Foundational paper on optimistic vs pessimistic concurrency control.

### Schema Evolution

7. **Avro Schema Resolution**
   - Apache Avro Documentation
   - https://avro.apache.org/docs/current/spec.html#Schema+Resolution
   - Demonstrates forward and backward compatibility patterns applicable to event schemas.

### Industry Case Studies

8. **Shopify Engineering (2020). "Deconstructing the Monolith"**
   - https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity
   - Describes Shopify's migration to event-sourced order management.

9. **Microsoft Azure Architecture Center: "Event Sourcing Pattern"**
   - https://docs.microsoft.com/en-us/azure/architecture/patterns/event-sourcing
   - Cloud-native guidance on implementing event sourcing with Azure Event Hubs and Cosmos DB.

### Security and Compliance

10. **NIST SP 800-92: "Guide to Computer Security Log Management"**
    - National Institute of Standards and Technology
    - Regulatory justification for immutable audit logs.
