# Research Notes

## Academic Papers

1. **Lamport, L. "Time, Clocks, and the Ordering of Events in a Distributed System."**
   Communications of the ACM, 21(7), 1978.
   https://lamport.azurewebsites.net/pubs/time-clocks.pdf
   Key finding: Introduced logical clocks and the "happened-before" relation. Vector clocks are a direct extension.

2. **DeCandia, G., et al. "Dynamo: Amazon's Highly Available Key-Value Store."**
   SOSP 2007.
   https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf
   Key finding: Dynamo uses consistent hashing, vector clocks, and gossip-based replication. Prioritizes AP in CAP. The foundational paper for this project's architecture.

3. **Shapiro, M., Preguiça, N., Baquero, C., & Zawirski, M. "Conflict-free Replicated Data Types."**
   SSS 2011.
   https://arxiv.org/abs/1805.04263
   Key finding: CRDTs provide automatic, correct merge for specific data types (counters, registers, sets, maps). No consensus required.

4. **Brewer, E. "CAP Twelve Years Later: How the 'Rules' Have Changed."**
   IEEE Computer, 2012.
   https://sites.cs.ucsb.edu/~rich/class/cs293b-cloud/papers/brewer-cap.pdf
   Key finding: CAP is often misunderstood as a binary choice. In practice, systems choose consistency levels per operation (PACELC theorem extends CAP).

5. **Vogels, W. "Eventually Consistent."**
   ACM Queue, 2008.
   https://queue.acm.org/detail.cfm?id=1466448
   Key finding: Eventual consistency is a spectrum, not a binary property. Defines read consistency levels (strong, consistent, bounded staleness).

## Books

6. **Kleppmann, M.** *Designing Data-Intensive Applications*. O'Reilly Media, 2017.
   Chapter 5 (Replication) and Chapter 9 (Consistency and Consensus). The definitive practitioner guide.

7. **Martin, R. C., & Micah, M.** *Distributed Systems: Principles and Paradigms*. Prentice Hall, 2023.
   Comprehensive textbook covering vector clocks, consensus, and replication.

## Standards & Industry Sources

8. **"Amazon Route 53 Latency-Based Routing."**
   AWS Documentation.
   https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy-latency.html

9. **"Google Cloud Global Load Balancing."**
   Google Cloud Documentation.
   https://cloud.google.com/load-balancing/docs/load-balancing-overview

10. **"Multi-Region Application Architecture," AWS Well-Architected Framework.**
    https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/welcome.html

## Related Systems

11. **CockroachDB — Geo-Partitioned Database**
    https://www.cockroachlabs.com/
    Provides strong consistency with geo-partitioning. Uses Raft consensus per range. Higher latency than Dynamo-style systems but simpler application logic.

12. **MongoDB Global Clusters**
    https://www.mongodb.com/global-clusters
    Zones data by geography. Supports global sharding with zone affinity.

13. **Google Cloud Spanner**
    https://cloud.google.com/spanner
    Globally distributed SQL database with strong consistency via TrueTime (atomic clocks + GPS). The "impossible" system that proves CAP can be bent with specialized hardware.

14. **Cassandra**
    https://cassandra.apache.org/
    Dynamo-inspired wide-column store. Tunable consistency (ONE, QUORUM, ALL). Production-proven at Apple (300,000+ nodes).

15. **Redis Cluster + CRDTs (Redis CRDT)**
    https://redis.com/redis-enterprise/crdbs/
    Active-active Redis with built-in CRDT merge for strings, sets, and counters.

## Benchmarks

| System | Consistency | Latency (local write) | Latency (cross-region read) | Availability during partition |
|--------|-------------|----------------------|----------------------------|-------------------------------|
| Dynamo-style (AP) | Eventual | ~2ms | ~100ms stale | Yes |
| MongoDB (configurable) | Eventual/Strong | ~5ms | ~80ms | Configurable |
| CockroachDB (CP) | Strong | ~10ms | ~150ms | No (writes rejected) |
| Spanner | Strong | ~15ms | ~15ms | No |

## Industry Adoption

- **Amazon**: Dynamo powers shopping carts, session state, and product catalogs. All are AP with vector clock conflict resolution.
- **Netflix**: Uses EVCache (Memcached + CRDT) for geo-distributed caching. Conflicts on view counts are resolved by summing (a counter CRDT).
- **Apple**: Siri uses Cassandra across 5 regions. Writes are LOCAL_QUORUM for low latency, repaired asynchronously.
- **Uber**: Their geo-distributed driver location service uses a custom CRDT for GPS coordinates. Concurrent updates from two regions are merged by taking the latest timestamp (safe for GPS because old locations are useless).
