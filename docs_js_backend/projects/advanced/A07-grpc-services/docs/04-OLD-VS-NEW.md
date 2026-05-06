# Old Ways vs New Ways (2025)

## Pattern: Service Communication

### The Old Way (2010-2015)
```javascript
// REST JSON over HTTP/1.1
const response = await fetch('http://user-service:3000/users/123');
const user = await response.json();
```
**Why we did it:** Simple, universal, easy to debug with curl.
**Why it's wrong now:** HTTP/1.1 requires a new TCP connection per request (or serializes on keep-alive). JSON parsing is slow. No strong typing.

### The New Way (2025)
```typescript
const deadline = new Date(Date.now() + 5000);
userClient.getUser({ id: '123' }, { deadline }, (err, user) => {
  if (err) { /* handle */ }
  console.log(user.email); // TypeScript knows this is a string
});
```
**Why it's better:** One HTTP/2 connection for all RPCs. Binary protobuf parsing. Type safety. Deadlines prevent resource leaks.

### Migration Path
1. Define proto schemas for all service APIs.
2. Generate gRPC clients/servers.
3. Run a sidecar gateway (Envoy) for HTTP/1.1 clients.
4. Deprecate REST internal APIs.

## Pattern: API Versioning

### The Old Way
URL-based versioning: `/v1/orders`, `/v2/orders`.
**Why it's wrong:** Breaking changes affect all clients. Hard to maintain multiple versions.

### The New Way
Protobuf field evolution with `reserved`.
**Why it's better:** Backward and forward compatible. Clients can upgrade independently.

## Pattern: Error Handling

### The Old Way
HTTP status codes + JSON error body.
**Why it's wrong:** Inconsistent across services. Hard to program against.

### The New Way
gRPC status codes (NOT_FOUND, UNAVAILABLE, DEADLINE_EXCEEDED) with structured `Status` details.
**Why it's better:** Uniform across all languages. Automatic retry logic based on status code.
