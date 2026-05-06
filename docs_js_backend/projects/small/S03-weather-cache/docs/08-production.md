# S03 Weather Cache — Production Guide

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDIS_URL` | `redis://localhost:6379` | Cache store |
| `PORT` | `3000` | HTTP port |
| `REDIS_TTL_SECONDS` | `3600` | Redis key TTL |
| `STALE_THRESHOLD_MS` | `600000` | Freshness threshold |
| `MOCK_API_DELAY_MS` | `100` | Simulated API latency (remove in prod) |

## Redis Configuration

```conf
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
appendonly yes
```

**Why `allkeys-lru`?** If memory is full, evict least-recently-used keys. This preserves hot cities while dropping cold ones.

**Why AOF?** Ensures cache survives restart. For weather, RDB snapshots are also sufficient.

## Observability

### Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Cache hit rate | Redis `INFO stats` keyspace_hits / (hits+misses) | <80% |
| API latency p99 | Application logs | >500 ms |
| Stampede events | Custom counter (lock contention) | >5/min |
| Redis memory usage | Redis `INFO memory` | >80% |
| Error rate | Application logs | >1% |

### Grafana Query Example
```promql
rate(redis_keyspace_hits_total[5m]) /
(rate(redis_keyspace_hits_total[5m]) + rate(redis_keyspace_misses_total[5m]))
```

## Scaling

- **Stateless app**: Yes. Scale horizontally; Redis is the single source of truth.
- **Redis scaling**:
  - Single node: Up to ~100K ops/sec, enough for most workloads.
  - Redis Cluster: Shard by city hash for >1M ops/sec.
  - Read replicas: Offload `GET` traffic; keep writes on primary.

## CDN Integration

For truly massive scale, put a CDN (Cloudflare, Fastly) in front:

```
Client → CDN → App → Redis → API
```

Set `Cache-Control: max-age=600, stale-while-revalidate=3000` on responses. The CDN then serves cache hits without ever reaching your app.

**Trade-off**: You lose per-user customization (e.g., preferred units). Use edge functions or cache by `?units=` query param.

## Incident Response

**API provider outage**
1. Verify stale cache is serving (monitor `source=stale_cache` logs).
2. Extend `STALE_THRESHOLD_MS` temporarily to 24 hours if outage is prolonged.
3. Communicate to users that data may be outdated.
4. If stale cache expires before API recovers, serve 503 with a friendly message.

**Cache stampede detected**
1. Deploy lock fix immediately.
2. Warm cache manually for top 100 cities.
3. Add jitter to TTL so keys do not expire simultaneously.
