# Troubleshooting Guide

## Common Issues

### Race Condition in Aggregation

**Symptom**: Event counts are lower than expected

**Root Cause**: Non-atomic read-modify-write operations
```typescript
// BUG: Race condition
const currentCount = await redis.get(counterKey);
const newCount = parseInt(currentCount ?? '0', 10) + 1;
await redis.set(counterKey, newCount.toString());
```

**Fix**: Use atomic operations
```typescript
// FIXED: Atomic increment
await redis.incr(counterKey);
```

**Verification**:
```bash
# Send 100 events quickly
for i in {1..100}; do
  curl -X POST http://localhost:3000/events \
    -d '{"eventType":"test","payload":{}}' &
done
wait

# Check count
curl http://localhost:3000/metrics?eventType=test
```

### Redis Memory Exhaustion

**Symptom**: "OOM command not allowed" errors

**Root Cause**: No TTL on keys or window cleanup

**Fix**:
```bash
# Set TTL on all keys
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Implement window cleanup
AGGREGATION_WINDOW_MS=60000
METRICS_RETENTION_HOURS=24
```

### Database Connection Pool Exhaustion

**Symptom**: "Too many connections" errors

**Fix**:
```typescript
const prisma = new PrismaClient({
  connectionLimit: 20,
});
```

### High Latency in Dashboard

**Symptom**: Dashboard API slow to respond

**Causes**:
1. No indexes on event table
2. Querying too much historical data
3. Redis not used for hot data

**Fixes**:
```sql
-- Add indexes
CREATE INDEX CONCURRENTLY idx_events_type_time ON events(event_type, timestamp);
CREATE INDEX CONCURRENTLY idx_events_window ON events(window_key);
```

### Event Validation Failures

**Symptom**: 400 Bad Request on event ingestion

**Common Causes**:
- Missing required fields
- Invalid JSON payload
- Event type too long (>100 chars)

**Debug**:
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{"eventType":"test","payload":{}}' \
  -v
```

## Performance Issues

### Slow Aggregation

**Diagnostic**:
1. Check Redis latency: `redis-cli --latency`
2. Check PostgreSQL query times
3. Review batch sizes

**Solutions**:
- Use Redis pipelining
- Increase batch sizes
- Use Lua scripts for complex operations

### Data Loss

**Symptom**: Events ingested but not in metrics

**Causes**:
1. Race condition in aggregation
2. Redis connection lost
3. Events not persisted to PostgreSQL

**Debug**:
```sql
-- Check PostgreSQL
SELECT COUNT(*) FROM events WHERE event_type = 'test';

-- Check Redis
redis-cli GET counter:test:<window>
```

## Debugging Tools

### Redis Monitoring
```bash
# Monitor all commands
redis-cli monitor

# Check memory usage
redis-cli INFO memory

# Check key count
redis-cli DBSIZE
```

### PostgreSQL Monitoring
```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Slow queries
SELECT query, mean_exec_time 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

### Application Logs
```bash
# Enable debug logging
DEBUG=analytics:* npm run dev

# Structured logging
LOG_FORMAT=json npm start
```

## Error Codes Reference

| Error | Cause | Solution |
|-------|-------|----------|
| 400 INVALID_INPUT | Validation failed | Check event schema |
| 400 BATCH_TOO_LARGE | Batch > 100 events | Split into smaller batches |
| 429 RATE_LIMITED | Too many requests | Implement backoff |
| 500 REDIS_ERROR | Redis connection lost | Check Redis status |
| 500 DB_ERROR | Database error | Check PostgreSQL logs |

## Getting Help

- Redis Community: https://redis.io/community/
- PostgreSQL Mailing Lists: https://www.postgresql.org/list/
- Stack Overflow: [redis] [postgresql] [analytics] tags