# S03 Weather Cache — References

## Redis Documentation

1. **Redis — Keyspace Notifications & TTL**
   https://redis.io/docs/latest/develop/use/keyspace-notifications/
   > How to subscribe to expiration events for proactive refresh.

2. **Redis — Distributed Locks with Redlock**
   https://redis.io/docs/manual/patterns/distributed-locks/
   > Official pattern for implementing mutexes across Redis instances.

3. **Redis Persistence: RDB vs AOF**
   https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/
   > Guidance on choosing snapshotting vs append-only files for cache durability.

## Caching Patterns

4. **Martin Fowler — Cache-Aside Pattern**
   https://martinfowler.com/bliki/CacheAside.html
   > Explanation of lazy-loading caches and when to use them.

5. **AWS Architecture Blog — Caching Best Practices**
   https://aws.amazon.com/caching/best-practices/
   > Covers TTL strategies, eviction policies, and cache warming.

6. **Google SRE Book — Handling Overload (Cache Stampede)**
   https://sre.google/sre-book/handling-overload/
   > Discusses load shedding, circuit breakers, and stampede prevention.

## HTTP Caching

7. **MDN — Cache-Control**
   https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
   > Formal definition of `max-age`, `stale-while-revalidate`, and `immutable`.

8. **RFC 7234 — Hypertext Transfer Protocol (HTTP/1.1): Caching**
   https://datatracker.ietf.org/doc/html/rfc7234
   > The canonical specification for HTTP cache semantics.

## Circuit Breakers & Resilience

9. **Netflix Tech Blog — Fault Tolerance in a High Volume, Distributed System**
   https://netflixtechblog.com/fault-tolerance-in-a-high-volume-distributed-system-91ab4faae74a
   > How Netflix uses Hystrix for circuit breaking and bulkheading.

10. **Microsoft — Transient Fault Handling**
    https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults
    > Retry policies, exponential backoff, and detecting transient vs permanent failures.

## Load Testing

11. **k6 Documentation — Load Testing**
    https://k6.io/docs/
    > Tool used for simulating cache stampedes and measuring p99 latency.
