# A07 Evolution: v2 — Add TypeScript

## State of the System

The REST JSON services have been replaced by gRPC servers and an Express gateway. TypeScript interfaces are generated from `.proto` files, giving compile-time guarantees that the gateway and the services speak the same schema.

## What Changed

- **Proto definitions as source of truth.**
  - `user.proto` — `UserService` with `GetUser`, `ListUsers` (server-streaming), `CreateUser`.
  - `order.proto` — `OrderService` with `CreateOrder`, `GetOrder`, `ListUserOrders` (server-streaming).
  - `order_v1.proto` — intentionally divergent field name (`total_cents` vs `amount_cents`) to demonstrate proto mismatch bugs.
- **Generated types via `@grpc/proto-loader`.** `protoLoader.loadSync()` produces a package definition that `grpc.loadPackageDefinition()` casts to TypeScript-friendly service descriptors.
- **Gateway pattern.** The Express gateway (`src/gateway/index.ts`) translates REST JSON to gRPC protobuf. Clients speak HTTP/1.1; services speak HTTP/2.
- **Server-streaming RPCs.** `ListUsers` and `ListUserOrders` stream records one at a time via `call.write()` and `call.end()`. This avoids loading thousands of rows into memory.

## What Still Breaks

- **No deadlines on gRPC calls.** The gateway creates clients with `grpc.credentials.createInsecure()` and no timeout. If a service hangs, the gateway event loop stalls forever.
- **No retry logic.** A brief network blip during a rolling deployment causes a user-visible 500 error. gRPC has built-in retry policies, but they are not configured.
- **Proto version mismatch.** The gateway loads `order_v1.proto` (`total_cents = 3`), while the Order Service loads `order.proto` (`amount_cents = 3`). gRPC silently ignores unknown fields, so the server sees `amount_cents = 0` even though the client sent `total_cents: 5000`.
- **No error-code mapping.** Every gRPC error becomes a generic HTTP 500. `NOT_FOUND` and `DEADLINE_EXCEEDED` are indistinguishable to the client.

## Code Snapshot (gateway/clients.ts)

```typescript
const userProto = loadProto(join(__dirname, '../proto/user.proto'));
const orderProto = loadProto(join(__dirname, '../proto/order_v1.proto')); // BUG: v1 vs v2 mismatch

export const userClient = new userProto.users.UserService(
  USER_ADDR,
  grpc.credentials.createInsecure() // BUG: no deadline
);

export const orderClient = new orderProto.orders.OrderService(
  ORDER_ADDR,
  grpc.credentials.createInsecure() // BUG: no deadline
);
```

## Architectural Notes

This is the "basic gRPC + protobuf" stage. The system has moved from text-based JSON to binary protobuf, gaining ~3x smaller payloads and ~5x faster parsing. However, it is missing the production features that make gRPC reliable: deadlines, retries, and proper error handling. The proto mismatch bug is a realistic failure mode that teaches the lesson: **protobuf's wire format is number-based, not name-based**.

## Migration Path to v3

1. Add Zod validation to the REST gateway so malformed JSON is rejected before translation to gRPC.
2. Fix the proto mismatch by using `reserved` for renamed fields and ensuring all services load the same proto version.
3. Introduce gRPC deadlines and retry policies via `grpc.service_config`.
