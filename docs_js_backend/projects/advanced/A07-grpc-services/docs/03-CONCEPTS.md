# Concepts Explained

## Concept: Protocol Buffers

### What Is It?
A language-neutral, platform-neutral mechanism for serializing structured data. You define `.proto` files, and the protobuf compiler generates code in your target language.

### Why Do We Use It?
- Smaller than JSON (binary encoding).
- Faster parsing (no string scanning).
- Strong typing (generated TypeScript interfaces).
- Forward/backward compatibility via field numbers.

### How Does It Work?
```protobuf
message Order {
  string id = 1;
  string user_id = 2;
  int64 amount_cents = 3;
}
```
Each field has a number. The wire format sends `(field_number, wire_type, value)`. Old clients ignore unknown fields. New clients use defaults for missing fields.

### Common Misconceptions
- **Wrong way**: Renaming a field: `total_cents = 3` → `amount_cents = 3`.
- **Right way**: Add a new field with a new number: `amount_cents = 7; reserved 3;`.

## Concept: HTTP/2

### What Is It?
The second major version of HTTP. Supports multiplexing (many streams over one connection), header compression (HPACK), and server push.

### Why Does gRPC Need It?
gRPC uses HTTP/2's features:
- **Multiplexing**: Many RPCs share one TCP connection.
- **Binary framing**: Efficient protobuf transport.
- **Flow control**: Backpressure prevents overwhelming the receiver.

### Code Example
```typescript
const client = new OrderService('localhost:50052', grpc.credentials.createInsecure());
// Under the hood, this opens ONE HTTP/2 connection.
// All RPCs (createOrder, getOrder, listUserOrders) share it.
```

## Concept: Deadlines

### What Is It?
A time limit on how long an RPC can run. If exceeded, the call is cancelled.

### Why Is It Critical?
Without deadlines, a slow service can hold resources forever:
```typescript
// DANGER: No deadline
client.createOrder(req, callback);
// If the server hangs, this callback is never called.
```

### The Right Way
```typescript
const deadline = new Date(Date.now() + 5000);
client.createOrder(req, { deadline }, callback);
// After 5 seconds, gRPC automatically cancels with DEADLINE_EXCEEDED.
```
