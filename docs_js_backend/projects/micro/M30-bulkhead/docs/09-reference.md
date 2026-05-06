# Reference: Bulkhead Pattern

## API Endpoints

| Method | Path | Pool | Description |
|--------|------|------|-------------|
| GET | `/critical` | A | Critical user-facing request |
| GET | `/background` | B | Background job |

## Pool Configuration

| Pool | Name | Max Size | Purpose |
|------|------|----------|---------|
| A | critical | 3 | User-facing API |
| B | background | 3 | Background processing |

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Request processed |
| 503 | Pool is at capacity |

## Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Server setup |
| `src/bulkhead.ts` | Request routing and pool selection |
| `src/pool.ts` | Pool capacity tracking |

## Further Reading

- Bulkhead Pattern: https://microservices.io/patterns/reliability/bulkhead.html
- Release It! by Michael Nygard
- Hystrix Thread Pools: https://github.com/Netflix/Hystrix/wiki/How-it-Works#ThreadPool
