# A07: gRPC Microservices

A production-style microservices architecture using gRPC for inter-service communication. Includes a User service, an Order service, and an HTTP gateway.

## Architecture

- **Express 5 Gateway** with TypeScript (ESM)
- **User Service** (gRPC) — unary and streaming RPCs
- **Order Service** (gRPC) — unary and streaming RPCs
- **Protocol Buffers** for schema definition
- **@grpc/grpc-js** for Node.js gRPC implementation

## Thinking Framework

### Phase 1: Core Features
1. User service: CreateUser, GetUser, ListUsers (streaming)
2. Order service: CreateOrder, GetOrder, ListUserOrders (streaming)
3. HTTP Gateway translates REST to gRPC
4. Load balancing via multiple backend instances

### Phase 2: Robustness
- **Deadlines/Timeouts**: Every RPC must have a deadline to prevent resource leaks.
- **Retry Logic**: Transient network failures should be retried with backoff.
- **Proto Version Compatibility**: Adding, removing, or renaming fields must be done safely.

### Phase 3: Bug Analysis

**Intentional Bug 1: No Deadline / Timeout**

Located in `src/gateway/clients.ts`.

Both `userClient` and `orderClient` are created without a deadline option:

```typescript
// VULNERABLE CODE:
const userClient = new UserService(USER_ADDR, grpc.credentials.createInsecure());
// No deadline — if the service hangs, the request hangs forever.
```

**Impact**: Gateway thread pool exhaustion. Cascading failures. HTTP clients timeout while gRPC calls leak resources.

**Fix**: Pass a deadline to every call:
```typescript
userClient.getUser(req, { deadline: Date.now() + 5000 }, callback);
```

**Intentional Bug 2: No Retry Logic**

Located in `src/gateway/clients.ts`.

gRPC clients are created without a service config containing retry policies. A single `UNAVAILABLE` error fails the request immediately.

**Impact**: Brief network blips cause user-visible 500 errors.

**Fix**: Configure a service config with retryPolicy:
```json
{
  "methodConfig": [{
    "name": [{}],
    "retryPolicy": {
      "maxAttempts": 4,
      "initialBackoff": "0.1s",
      "maxBackoff": "1s",
      "backoffMultiplier": 2,
      "retryableStatusCodes": ["UNAVAILABLE"]
    }
  }]
}
```

**Intentional Bug 3: Proto Version Mismatch**

Located in `src/gateway/clients.ts` and `src/order-service/index.ts`.

The gateway loads `order_v1.proto` (field `total_cents`). The order service loads `order.proto` (field renamed to `amount_cents`). gRPC silently ignores unknown fields, so `amount_cents` defaults to `0`:

```protobuf
// Gateway sends (v1):
message Order { int64 total_cents = 3; }

// Server expects (v2):
message Order { int64 amount_cents = 3; }
```

**Impact**: Orders are created with `amount_cents = 0`. Revenue loss, data corruption.

**Fix**: Use proto backward-compatibility rules. Never rename fields — only add new ones with new numbers. Or use `reserved` keyword. Ensure all services use the same proto version.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/users` | Create user (proxies to UserService) |
| GET | `/users/:id` | Get user (proxies to UserService) |
| POST | `/orders` | Create order (proxies to OrderService) |
| GET | `/orders/:id` | Get order (proxies to OrderService) |
| GET | `/health` | Health check |

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Run tests (some will fail due to intentional bugs)
npm test

# Start services (in separate terminals)
USER_SERVICE_PORT=50051 tsx watch src/user-service/index.ts
ORDER_SERVICE_PORT=50052 tsx watch src/order-service/index.ts
GATEWAY_PORT=3000 tsx watch src/gateway/index.ts
```

## Environment Variables

```env
USER_SERVICE_PORT=50051
ORDER_SERVICE_PORT=50052
GATEWAY_PORT=3000
USER_SERVICE_ADDR=localhost:50051
ORDER_SERVICE_ADDR=localhost:50052
```

## Testing the Bugs

### Proto Mismatch
```bash
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"email":"a@b.com","name":"A"}'
# Note the returned user_id, then:
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" \
  -d '{"user_id":"1","total_cents":5000,"items":[]}'
# The response shows amount_cents: 0 instead of 5000.
```

### No Deadline
```bash
# Stop the order service, then:
curl -X POST http://localhost:3000/orders -H "Content-Type: application/json" \
  -d '{"user_id":"1","total_cents":1000,"items":[]}'
# The gateway hangs because there is no gRPC deadline.
```
