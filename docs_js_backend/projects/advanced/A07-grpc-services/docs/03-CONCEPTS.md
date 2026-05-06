# Concepts Explained

## Concept: Protocol Buffers

### WHAT Is It?
A language-neutral, platform-neutral mechanism for serializing structured data. You define `.proto` files, and the protobuf compiler (`protoc`) generates code in your target language.

### WHY Do We Use It?
- **Smaller than JSON**: Binary encoding uses variable-length integers and length-delimited fields.
- **Faster parsing**: No string scanning or unicode escaping. Direct byte-level deserialization.
- **Strong typing**: Generated TypeScript interfaces catch schema mismatches at compile time.
- **Forward/backward compatibility**: Via field numbers, not field names.

### HOW Does It Work?
```protobuf
message Order {
  string id = 1;
  string user_id = 2;
  int64 amount_cents = 3;
}
```
Each field has a **number** (the wire key). The wire format sends `(field_number, wire_type, value)`. Old clients ignore unknown field numbers. New clients use defaults for missing fields.

### WRONG vs RIGHT

**WRONG** — Renaming a field while keeping the same number:
```protobuf
// v1 (client)
message Order { int64 total_cents = 3; }

// v2 (server) — DANGEROUS RENAME
message Order { int64 amount_cents = 3; }
```
The wire format sends field number `3` with a varint value. The receiver sees number `3` and assigns it to whatever field name it knows. If the names differ, the data is silently mislabeled. gRPC does NOT validate field names on the wire.

**RIGHT** — Add a new field, reserve the old:
```protobuf
message Order {
  string id = 1;
  string user_id = 2;
  int64 amount_cents = 7;   // NEW field with NEW number
  string status = 4;
  repeated OrderItem items = 5;
  string created_at = 6;
  reserved 3;
  reserved "total_cents";
}
```
`reserved` tells the protobuf compiler to reject any code that uses the old field name or number. This is a compile-time safety net.

---

## Concept: HTTP/2

### WHAT Is It?
The second major version of HTTP. Uses binary framing instead of text. Supports multiplexing, header compression (HPACK), and flow control.

### WHY Does gRPC Need It?
gRPC is fundamentally built on HTTP/2 features:
- **Multiplexing**: Many RPCs share one TCP connection. No head-of-line blocking.
- **Binary framing**: Efficient protobuf transport without base64 encoding.
- **Flow control**: Backpressure prevents a fast sender from overwhelming a slow receiver.
- **Server push / trailers**: gRPC uses trailers to send status codes after the body.

### HOW Does It Work?
```typescript
const client = new OrderService('localhost:50052', grpc.credentials.createInsecure());
// Under the hood, this opens ONE HTTP/2 connection.
// All RPCs (createOrder, getOrder, listUserOrders) share it.
```

### WRONG vs RIGHT

**WRONG** — Creating a new connection per RPC:
```typescript
// Anti-pattern: new client per request
function bad() {
  const c = new OrderService(addr, creds); // Opens new TCP + TLS handshake every time
  c.createOrder(req, cb);
}
```
This destroys the primary benefit of HTTP/2 and causes TCP/TLS handshake overhead.

**RIGHT** — Reuse one client instance:
```typescript
const client = new OrderService(addr, creds);
function good() {
  client.createOrder(req, cb); // Reuses existing HTTP/2 connection
}
```

---

## Concept: Deadlines / Timeouts

### WHAT Is It?
A time limit on how long an RPC can run. If exceeded, gRPC automatically cancels the call with status `DEADLINE_EXCEEDED`.

### WHY Is It Critical?
Without deadlines, a slow service can hold resources forever:
```typescript
// DANGER: No deadline
client.createOrder(req, callback);
// If the server hangs, this callback is never called.
// The HTTP/2 stream stays open. Memory leaks. Thread pool exhausted.
```

### HOW Does It Work?
```typescript
const deadline = new Date(Date.now() + 5000);
client.createOrder(req, { deadline }, callback);
// After 5 seconds, gRPC automatically cancels with DEADLINE_EXCEEDED.
// The stream is closed. Resources are freed.
```

Deadlines propagate. If Service A calls Service B with a 5s deadline, and Service B calls Service C, the remaining time is forwarded. This is "deadline propagation."

### WRONG vs RIGHT

**WRONG** — Using JavaScript `setTimeout` to wrap the callback:
```typescript
setTimeout(() => cb(new Error('timeout')), 5000);
client.createOrder(req, cb);
```
The RPC continues running on the server. The HTTP/2 stream is not closed. This is a "fake timeout."

**RIGHT** — Using gRPC native deadline:
```typescript
const deadline = Date.now() + 5000;
client.createOrder(req, { deadline }, (err, resp) => {
  if (err && err.code === grpc.status.DEADLINE_EXCEEDED) {
    // Truly cancelled. Server is notified.
  }
});
```

---

## Concept: Retry Policies

### WHAT Is It?
Automatic retransmission of failed RPCs with exponential backoff. gRPC handles this at the library level, not the application level.

### WHY Do We Need It?
TCP retries lost packets, but it does NOT retry application-level RPCs on `UNAVAILABLE`. A rolling deployment, brief network blip, or GC pause can cause transient failures.

### HOW Does It Work?
```typescript
const serviceConfig = {
  methodConfig: [{
    name: [{}],
    retryPolicy: {
      maxAttempts: 4,
      initialBackoff: '0.1s',
      maxBackoff: '1s',
      backoffMultiplier: 2,
      retryableStatusCodes: ['UNAVAILABLE', 'DEADLINE_EXCEEDED'],
    },
  }],
};
```
Attempt 1: immediate. Attempt 2: 100ms. Attempt 3: 200ms. Attempt 4: 400ms. Max backoff caps at 1s.

### WRONG vs RIGHT

**WRONG** — Naive retry loop without backoff:
```typescript
for (let i = 0; i < 5; i++) {
  try { return await call(); } catch (e) { /* retry immediately */ }
}
```
This causes a "thundering herd" — if the server is overloaded, immediate retries amplify the problem.

**RIGHT** — Exponential backoff with jitter:
```typescript
const serviceConfig = {
  methodConfig: [{
    name: [{}],
    retryPolicy: {
      maxAttempts: 4,
      initialBackoff: '0.1s',
      maxBackoff: '1s',
      backoffMultiplier: 2,
      retryableStatusCodes: ['UNAVAILABLE'],
    },
  }],
};
```
Jitter randomizes the backoff to spread out retry attempts across time.
