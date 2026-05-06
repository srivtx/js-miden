# Architecture Decisions

## Decision: Protocol for Inter-Service Communication

### Option A: REST JSON
**Pros:** Human-readable, easy to debug, universal support.
**Cons:** Text encoding is slow, no streaming, weak typing.

### Option B: gRPC + Protobuf
**Pros:** Binary, fast, strong typing, HTTP/2 streaming.
**Cons:** Requires code generation, harder to debug without tools (grpcurl).

### Option C: GraphQL Federation
**Pros:** Flexible queries, single endpoint.
**Cons:** Overkill for internal services, adds complexity.

### What We Chose: gRPC + Protobuf
**Why:** For service-to-service, performance and type safety matter more than human readability.

## Decision: Gateway Pattern

### Option A: Clients Call gRPC Directly
**Pros:** No translation layer, lowest latency.
**Cons:** Browsers can't speak gRPC natively (without gRPC-Web proxy).

### Option B: Express Gateway Translates REST → gRPC
**Pros:** Familiar HTTP API for clients, centralized auth/rate-limiting.
**Cons:** Added latency (~1-2ms), another service to maintain.

### What We Chose: Express Gateway
**Why:** Separation of concerns. The gateway handles HTTP concerns (cors, auth, rate limiting) while services focus on business logic.

## Decision: Streaming RPCs

### Option A: Only Unary RPCs
**Pros:** Simple, predictable.
**Cons:** Large result sets require pagination or multiple round-trips.

### Option B: Server-Streaming for Lists
**Pros:** Real-time results, backpressure built into HTTP/2.
**Cons:** Slightly more complex client code.

### What We Chose: Server-Streaming for Lists
**Why:** `ListUsers` and `ListUserOrders` can return thousands of rows. Streaming avoids loading everything into memory at once.
