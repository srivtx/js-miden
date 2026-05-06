# Reference: API Gateway Basics

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| * | `/users/*` | Proxied to user service (:3001) |
| * | `/orders/*` | Proxied to order service (:3002) |

## Headers

| Header | Description |
|--------|-------------|
| `X-Request-ID` | Unique identifier added by gateway |

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Successful proxy |
| 404 | Route not matched |
| 502 | Bad Gateway (backend error) |
| 504 | Gateway Timeout (backend slow) |

## Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Server setup |
| `src/gateway.ts` | Proxy logic |
| `src/logger.ts` | Logging middleware |

## Further Reading

- Express.js Middleware: https://expressjs.com/en/guide/using-middleware.html
- Node.js `http.request`: https://nodejs.org/api/http.html#httprequestoptions-callback
- Reverse Proxy Patterns: https://microservices.io/patterns/apigateway.html
