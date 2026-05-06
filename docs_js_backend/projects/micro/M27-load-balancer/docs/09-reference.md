# Reference: Load Balancer

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| * | `/*` | Proxied to a backend via round-robin |

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `backends` | `[':3001', ':3002', ':3003']` | Backend server URLs |
| `healthCheckInterval` | `5000` | Milliseconds between health probes |
| `healthCheckPath` | `/health` | Path to probe on each backend |

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Successful proxy |
| 502 | Bad Gateway |
| 503 | Service Unavailable (no healthy backends) |

## Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Server setup |
| `src/balancer.ts` | Round-robin selection |
| `src/health.ts` | Health check logic |

## Further Reading

- Load Balancing Algorithms: https://www.nginx.com/resources/glossary/load-balancing/
- Health Check Patterns: https://microservices.io/patterns/observability/health-check-api.html
