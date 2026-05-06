# Reference: Service Discovery

## API Endpoints

| Method | Path | Body/Response | Description |
|--------|------|---------------|-------------|
| POST | `/register` | `{ name, url }` → `{ id }` | Register a service |
| POST | `/heartbeat/:id` | none | Renew lease |
| GET | `/discover/:name` | `[{ id, name, url }]` | Find services |

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `heartbeatTTL` | `30000` | Max ms since last heartbeat |
| `cleanupInterval` | `15000` | Ms between cleanup runs |

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid registration |
| 404 | Service not found |

## Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Server setup |
| `src/registry.ts` | In-memory registry |
| `src/heartbeat.ts` | Cleanup logic |

## Further Reading

- Service Discovery Patterns: https://microservices.io/patterns/server-side-discovery.html
- Consul: https://www.consul.io/
- Eureka: https://github.com/Netflix/eureka
