# The Bugs

## Bug 1: No Deadline / Timeout

### How to Introduce It
Create gRPC clients without any deadline configuration:

```typescript
export const userClient = new userProto.users.UserService(
  USER_ADDR,
  grpc.credentials.createInsecure()
);
```

### Why It Exists
The developer assumed the network was reliable and services would always respond quickly.

### Symptoms You'll See
- Gateway stops responding to new requests.
- Node.js event loop is blocked on pending gRPC calls.
- HTTP clients timeout after 30s while gRPC calls remain open.

### How to Reproduce
1. Start the gateway.
2. Stop the order service.
3. Send `POST /orders`. The request hangs indefinitely.

### The Fix
```typescript
const DEFAULT_DEADLINE_MS = 5000;

function withDeadline<T>(
  client: any,
  method: string,
  request: T,
  callback: (err: grpc.ServiceError | null, response?: any) => void
) {
  const deadline = new Date(Date.now() + DEFAULT_DEADLINE_MS);
  client[method](request, { deadline }, callback);
}
```

### Why the Fix Works
gRPC automatically cancels calls when the deadline is exceeded, freeing resources and returning `DEADLINE_EXCEEDED` to the callback.

### Real-World Impact
In 2017, a major cloud provider had a 4-hour outage because a gRPC service hung and its callers had no deadlines. The cascading failure took down 12 downstream services.

## Bug 2: No Retry Logic

### How to Introduce It
Create the client without a service config:

```typescript
const client = new OrderService(addr, credentials.createInsecure());
// No retryPolicy configured!
```

### Why It Exists
The developer thought "TCP handles retries." TCP retries packets, but it doesn't retry application-level RPCs on `UNAVAILABLE`.

### Symptoms You'll See
- Brief network blips (100ms) cause 500 errors.
- Users see error pages for transient failures.
- No resilience to rolling deployments.

### The Fix
```typescript
const serviceConfig = {
  loadBalancingConfig: [{ round_robin: {} }],
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

const client = new OrderService(addr, credentials.createInsecure(), {
  'grpc.service_config': JSON.stringify(serviceConfig),
});
```

### Why the Fix Works
gRPC's built-in retry mechanism automatically retries failed RPCs with exponential backoff. Transient failures become invisible to users.

## Bug 3: Proto Version Mismatch

### How to Introduce It
Rename a field in the proto without using `reserved`:

```protobuf
// v1 (client)
message Order { int64 total_cents = 3; }

// v2 (server) — DANGEROUS RENAME
message Order { int64 amount_cents = 3; }
```

### Why It Exists
The developer thought "the field number is the same, so it's compatible." But the field NAME changed, and old clients send `total_cents` while the server expects `amount_cents`.

### Symptoms You'll See
- Orders are created with `amount_cents = 0`.
- Financial data is silently corrupted.
- No errors — gRPC ignores unknown fields by default.

### How to Reproduce
1. Gateway loads `order_v1.proto` (total_cents).
2. Order service loads `order.proto` (amount_cents).
3. Create an order with `total_cents: 5000`.
4. Server receives nothing for field 3 (because the wire format sends field name + value, but the server decodes it as `amount_cents` which wasn't sent).

### The Fix
```protobuf
message Order {
  string id = 1;
  string user_id = 2;
  int64 amount_cents = 7; // NEW field number
  reserved 3;
  reserved "total_cents";
}
```

### Why the Fix Works
`reserved` tells the protobuf compiler to reject any code that uses the old field name or number. New clients must use `amount_cents` with number 7. Old clients will see `amount_cents` as missing (default 0) but won't corrupt data.
