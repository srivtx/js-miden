# Architecture Decisions

## Decision 1: Protocol for Inter-Service Communication

### Option A: REST JSON over HTTP/1.1
**Pros:** Human-readable, easy to debug with `curl`, universal support, massive ecosystem.
**Cons:** Text encoding is slow (~5x slower than protobuf parsing), no native streaming, weak typing (runtime schema validation required), HTTP/1.1 head-of-line blocking.

### Option B: gRPC + Protobuf over HTTP/2
**Pros:** Binary (3x smaller than JSON), fast parsing (~5x faster), strong typing via code generation, HTTP/2 streaming and multiplexing, built-in deadlines and status codes.
**Cons:** Requires protoc/code generation step, harder to debug without tools (grpcurl, BloomRPC), browser support needs gRPC-Web proxy.

### Option C: GraphQL Federation
**Pros:** Flexible queries, single endpoint, strong typing via schema.
**Cons:** Overkill for internal services, N+1 query risk, adds resolver complexity, worse performance for simple RPCs.

### Option D: tRPC or Connect-RPC
**Pros:** Type-safe without `.proto` files (tRPC), works over HTTP/1.1 and HTTP/2 (Connect).
**Cons:** tRPC locks you into TypeScript; Connect is newer with smaller ecosystem.

### What We Chose: gRPC + Protobuf
**Why:** For service-to-service, performance and type safety matter more than human readability. The gateway provides the human-friendly REST facade.

---

## Decision 2: Gateway Pattern

### Option A: Clients Call gRPC Directly
**Pros:** No translation layer, lowest latency (~1ms saved).
**Cons:** Browsers can't speak gRPC natively. Mobile apps need heavy gRPC client libraries. No centralized auth/CORS/rate-limiting.

### Option B: Express Gateway Translates REST → gRPC
**Pros:** Familiar HTTP API for clients, centralized cross-cutting concerns (auth, rate limiting, CORS, request logging).
**Cons:** Added latency (~1-2ms), another service to maintain, potential bottleneck if not scaled.

### Option C: Envoy Sidecar Proxy
**Pros:** Industry standard, handles gRPC-Web, load balancing, retries, TLS termination.
**Cons:** Adds infrastructure complexity (YAML configs), harder to customize business logic.

### What We Chose: Express Gateway
**Why:** Separation of concerns. The gateway handles HTTP concerns while services focus on business logic. Easier to reason about and debug for educational purposes.

---

## Decision 3: Streaming RPCs

### Option A: Only Unary RPCs
**Pros:** Simple, predictable, easy to retry, works with standard load balancers.
**Cons:** Large result sets require pagination (multiple round-trips) or buffering everything in memory.

### Option B: Server-Streaming for Lists
**Pros:** Real-time results, backpressure built into HTTP/2 flow control, lower memory footprint.
**Cons:** Slightly more complex client code, harder to retry mid-stream, requires careful error handling.

### Option C: Bidirectional Streaming
**Pros:** True real-time duplex (chat, live updates).
**Cons:** Overkill for request/response patterns, complex state machine.

### What We Chose: Server-Streaming for Lists
**Why:** `ListUsers` and `ListUserOrders` can return thousands of rows. Streaming avoids loading everything into memory at once and allows the client to start processing immediately.

---

## Decision 4: Load Balancing Strategy

### Option A: Client-Side Load Balancing
**Pros:** No extra hop, direct connection to backends.
**Cons:** Clients need to know backend topology, complex health checking.

### Option B: Server-Side Proxy (Envoy/NGINX)
**Pros:** Centralized health checks, TLS termination, consistent hashing.
**Cons:** Extra hop, single point of failure if not clustered.

### What We Chose: Client-Side Round-Robin (via gRPC service config)
**Why:** For a small cluster, gRPC's built-in `round_robin` load balancing config is sufficient. We pass multiple backend addresses or use DNS resolution.
