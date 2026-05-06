# Reference: Config Server

## API Endpoints

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/config/:app/:env` | `{ key: value, ... }` | Set config |
| GET | `/config/:app/:env` | - | Get config |

## Environments

| Environment | Purpose |
|-------------|---------|
| `dev` | Local development |
| `staging` | Pre-production testing |
| `prod` | Production deployment |

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid config values |
| 404 | App or environment not found |

## Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Server setup |
| `src/config.ts` | Storage logic |
| `src/validator.ts` | Validation rules |

## Further Reading

- Spring Cloud Config: https://spring.io/projects/spring-cloud-config
- Consul KV: https://developer.hashicorp.com/consul/docs/dynamic-app-config/kv
- Environment Isolation Best Practices: https://12factor.net/config
