# M31: HTTP Request ID Middleware

HTTP request ID generator and correlation middleware for Express.js.

## Features
- Generates UUID v4 per request
- Attaches `X-Request-ID` response header
- Propagates to downstream services
- Structured logging with request ID correlation

## Run

```bash
npm install
npm run dev       # Development with tsx
npm test          # Vitest
npm run build     # Compile to dist/
npm start         # Run compiled JS
```

## Docker
```bash
docker-compose up
```

## API
- `GET /health` - Health check with request ID
- `GET /data` - Sample data endpoint (may error)
- `GET /proxy` - Proxies to downstream with request ID header
