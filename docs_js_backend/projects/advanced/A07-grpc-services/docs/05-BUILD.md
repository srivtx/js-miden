# Step-by-Step Build Guide

## Step 1: Define Proto Files

Create `user.proto`:
```protobuf
syntax = "proto3";
package users;

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (stream User);
  rpc CreateUser(CreateUserRequest) returns (User);
}

message GetUserRequest { string id = 1; }
message ListUsersRequest { int32 page = 1; int32 page_size = 2; }
message CreateUserRequest { string email = 1; string name = 2; }
message User {
  string id = 1;
  string email = 2;
  string name = 3;
  string created_at = 4;
}
```

Create `order.proto`:
```protobuf
syntax = "proto3";
package orders;

service OrderService {
  rpc CreateOrder(CreateOrderRequest) returns (Order);
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc ListUserOrders(ListUserOrdersRequest) returns (stream Order);
}

message CreateOrderRequest {
  string user_id = 1;
  int64 amount_cents = 2;
  repeated OrderItem items = 3;
}
message GetOrderRequest { string id = 1; }
message ListUserOrdersRequest { string user_id = 1; }
message OrderItem {
  string sku = 1;
  int32 quantity = 2;
  int64 unit_price_cents = 3;
}
message Order {
  string id = 1;
  string user_id = 2;
  int64 amount_cents = 3;
  string status = 4;
  repeated OrderItem items = 5;
  string created_at = 6;
}
```

### Common Mistakes
- **Mistake**: Reusing field numbers after deletion.
- **Why it breaks**: Old clients may still send data for that number, corrupting the new field.
- **How to avoid**: Use `reserved 3; reserved "old_field";`.

---

## Step 2: Load Protos in Node.js

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const packageDefinition = protoLoader.loadSync('./proto/user.proto', {
  keepCase: true,
  longs: String,      // CRITICAL: 64-bit ints as strings
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as any;
```

### Common Mistakes
- **Mistake**: Using `longs: Number`.
- **Why it breaks**: 64-bit integers exceed JavaScript's safe integer range (2^53 - 1 = 9,007,199,254,740,991). A `total_cents` of $100,000,000.01 becomes `10000000000` (precision lost).
- **How to avoid**: Always use `longs: String` and parse with `BigInt` if arithmetic is needed.

---

## Step 3: Implement gRPC Server

```typescript
function getUser(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
  const user = users[call.request.id];
  if (!user) {
    callback({ code: grpc.status.NOT_FOUND, message: 'Not found' } as grpc.ServiceError, null);
    return;
  }
  callback(null, user);
}

function listUsers(call: grpc.ServerWritableStream<any, any>) {
  const page = call.request.page || 1;
  const pageSize = call.request.page_size || 10;
  const all = Object.values(users);
  const start = (page - 1) * pageSize;
  const slice = all.slice(start, start + pageSize);
  for (const user of slice) {
    call.write(user);  // Stream each user individually
  }
  call.end();  // Signal end of stream
}

const server = new grpc.Server();
server.addService(proto.users.UserService.service, { getUser, listUsers, createUser });
server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
  console.log('User service running');
});
```

### Common Mistakes
- **Mistake**: Not setting status codes on errors.
- **Why it breaks**: Clients can't distinguish "not found" (safe to show user) from "server error" (should retry). Retry logic depends on status codes.
- **How to avoid**: Always use `grpc.status.*` codes. `NOT_FOUND`, `INVALID_ARGUMENT`, `UNAVAILABLE`, `INTERNAL`.

---

## Step 4: Create the HTTP Gateway

```typescript
import express from 'express';
import { userClient, orderClient } from './clients.js';

const app = express();
app.use(express.json());

app.get('/users/:id', (req, res) => {
  const deadline = new Date(Date.now() + 5000);
  userClient.getUser({ id: req.params.id }, { deadline }, (err, user) => {
    if (err) {
      if (err.code === grpc.status.NOT_FOUND) return res.status(404).json({ error: 'NOT_FOUND' });
      if (err.code === grpc.status.DEADLINE_EXCEEDED) return res.status(504).json({ error: 'TIMEOUT' });
      return res.status(500).json({ error: err.message });
    }
    res.json({ data: user });
  });
});
```

### Common Mistakes
- **Mistake**: Not setting a deadline on gRPC calls.
- **Why it breaks**: Gateway threads hang forever if the downstream service is unresponsive. The Node.js event loop is blocked. HTTP clients timeout while gRPC streams leak.
- **How to avoid**: Always pass `{ deadline: Date.now() + timeoutMs }`.

---

## Step 5: Configure Retry and Load Balancing

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

const client = new OrderService(addr, grpc.credentials.createInsecure(), {
  'grpc.service_config': JSON.stringify(serviceConfig),
});
```

---

## Step 6: Testing

```bash
# Start services
USER_SERVICE_PORT=50051 tsx watch src/user-service/index.ts
ORDER_SERVICE_PORT=50052 tsx watch src/order-service/index.ts
GATEWAY_PORT=3000 tsx watch src/gateway/index.ts

# Test REST → gRPC translation
curl http://localhost:3000/users/1

# Test streaming
curl http://localhost:3000/orders?user_id=1

# Run tests (some fail due to intentional bugs)
npm test
```
