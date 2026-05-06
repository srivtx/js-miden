# HOW: API Gateway Basics

## How the Gateway Works

### 1. Request Reception
The Express server listens on port 3000. Every incoming request passes through middleware in this order:

1. **Logger Middleware**: Logs the method, path, and current timestamp.
2. **Request ID Middleware**: Generates a UUID and attaches it as `X-Request-ID`.
3. **Proxy Middleware**: Matches the path prefix and forwards the request.

### 2. Routing Logic

```typescript
if (req.path.startsWith('/users')) {
  target = 'http://localhost:3001';
} else if (req.path.startsWith('/orders')) {
  target = 'http://localhost:3002';
} else {
  res.status(404).send('Not Found');
}
```

### 3. Proxy Forwarding

The gateway uses `http.request` to forward the original method, headers, and body to the target service. It pipes the backend response back to the client.

### 4. Response Return

The backend response status, headers, and body are streamed back to the client with the `X-Request-ID` header preserved.

## File Breakdown

| File | Purpose |
|------|---------|
| `src/index.ts` | Creates the Express app, registers middleware, starts the server on :3000 |
| `src/logger.ts` | Middleware that logs `METHOD PATH → TARGET` for every request |
| `src/gateway.ts` | Core proxy logic: path matching, header forwarding, response piping |

## Running the Gateway

```bash
# Terminal 1: Start user service
npm run dev:user

# Terminal 2: Start order service
npm run dev:order

# Terminal 3: Start gateway
npm run dev:gateway

# Test
 curl http://localhost:3000/users/profile
# → forwarded to :3001/users/profile
```
