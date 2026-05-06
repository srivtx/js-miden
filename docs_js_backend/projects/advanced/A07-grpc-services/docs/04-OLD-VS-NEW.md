# Old Ways vs New Ways (2015 vs 2025)

## Pattern 1: Service Communication

### The Old Way (2010-2015)
```javascript
// REST JSON over HTTP/1.1
const response = await fetch('http://user-service:3000/users/123');
const user = await response.json();
```
**Why we did it:** Simple, universal, easy to debug with `curl`.
**Why it's wrong now:** HTTP/1.1 serializes requests (head-of-line blocking). JSON parsing is CPU-intensive string scanning. No strong typing — `user.emial` compiles but fails at runtime. No built-in deadlines.

### The New Way (2025)
```typescript
const deadline = new Date(Date.now() + 5000);
userClient.getUser({ id: '123' }, { deadline }, (err, user) => {
  if (err) {
    if (err.code === grpc.status.DEADLINE_EXCEEDED) {
      metrics.increment('rpc.timeout');
    }
    return;
  }
  console.log(user.email); // TypeScript knows this is a string. `user.emial` is a compile error.
});
```
**Why it's better:** One HTTP/2 connection for all RPCs. Binary protobuf parsing (5x faster). Type safety at compile time. Deadlines prevent resource leaks. Built-in retry policies.

### Migration Path
1. Define proto schemas for all service APIs.
2. Generate gRPC clients/servers with `@grpc/grpc-js` and `proto-loader`.
3. Run a sidecar gateway (Envoy or Express) for HTTP/1.1 clients.
4. Deprecate REST internal APIs. Monitor error rates.
5. Add mTLS for all inter-service communication.

---

## Pattern 2: API Versioning

### The Old Way
URL-based versioning: `/v1/orders`, `/v2/orders`.
**Why it's wrong:** Breaking changes affect all clients simultaneously. Hard to maintain multiple versions. Code duplication for v1 and v2 controllers.

### The New Way
Protobuf field evolution with `reserved`.
```protobuf
message Order {
  string id = 1;
  string user_id = 2;
  int64 amount_cents = 7;  // new field
  reserved 3;
  reserved "total_cents";
}
```
**Why it's better:** Backward and forward compatible. Old clients ignore `amount_cents`. New clients get default `0` for missing fields. No URL changes. Clients upgrade independently.

---

## Pattern 3: Error Handling

### The Old Way
HTTP status codes + inconsistent JSON error bodies:
```json
{ "error": "User not found", "code": 404 }
// Different service:
{ "message": "Not found", "status": 404, "details": { "resource": "user" } }
```
**Why it's wrong:** Inconsistent across services. Hard to program reliable retry logic. Status codes overlap (404 could mean user not found OR endpoint not found).

### The New Way
gRPC status codes with structured `Status` details:
```typescript
if (err.code === grpc.status.NOT_FOUND) {
  // Definitely the resource, not the endpoint
  return res.status(404).json({ error: 'NOT_FOUND', resource: 'user' });
}
if (err.code === grpc.status.UNAVAILABLE) {
  // Safe to retry with backoff
  return retryWithBackoff(req);
}
if (err.code === grpc.status.DEADLINE_EXCEEDED) {
  // Downstream is too slow — shed load
  return res.status(504).json({ error: 'TIMEOUT' });
}
```
**Why it's better:** Uniform across all languages. Automatic retry logic based on well-defined status codes. Rich error details via `google.rpc.Status`.

---

## Pattern 4: Load Balancing

### The Old Way
NGINX upstream with round-robin HTTP/1.1:
```nginx
upstream user_service {
  server user1:3000;
  server user2:3000;
}
```
**Why it's wrong:** Each request opens a new TCP connection (or reuses one from a pool). Health checks are coarse. No awareness of RPC-level failures.

### The New Way
gRPC client-side load balancing with health checking:
```typescript
const client = new UserService('dns:///user-service:50051', creds, {
  'grpc.service_config': JSON.stringify({
    loadBalancingConfig: [{ round_robin: {} }],
    healthCheckConfig: { serviceName: 'users.UserService' },
  }),
});
```
**Why it's better:** One TCP connection per backend, many RPCs multiplexed. Sub-channel health checks. Automatic failover on RPC failures, not just TCP failures.

---

## Pattern 5: Observability

### The Old Way
Custom middleware logging unstructured text:
```javascript
console.log(`Request to ${req.url} took ${Date.now() - start}ms`);
```
**Why it's wrong:** Unstructured logs are impossible to query at scale. No distributed tracing. Can't correlate a gateway request with downstream service calls.

### The New Way
OpenTelemetry + gRPC interceptors:
```typescript
// Interceptor injects trace context into gRPC metadata
const metadata = new grpc.Metadata();
metadata.set('x-request-id', traceId);
metadata.set('x-b3-traceid', traceId);
// Downstream services continue the trace automatically
```
**Why it's better:** Every RPC is a span in a distributed trace. Request ID propagation across the entire call graph. Structured metrics exportable to Prometheus/Grafana.
