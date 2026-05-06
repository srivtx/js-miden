# Step-by-Step Build Guide

## Step 1: Define Proto Files

Create `user.proto` and `order.proto` with service definitions.

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

### Common Mistakes
- **Mistake**: Reusing field numbers after deletion.
- **Why it breaks**: Old clients may still send data for that number, corrupting the new field.
- **How to avoid**: Use `reserved 3; reserved "old_field";`.

## Step 2: Load Protos in Node.js

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const packageDefinition = protoLoader.loadSync('./proto/user.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as any;
```

### Common Mistakes
- **Mistake**: Using `longs: Number`.
- **Why it breaks**: 64-bit integers exceed JavaScript's safe integer range (2^53).
- **How to avoid**: Always use `longs: String` and parse with `BigInt` if needed.

## Step 3: Implement gRPC Server

```typescript
function getUser(call, callback) {
  const user = users[call.request.id];
  if (!user) {
    callback({ code: grpc.status.NOT_FOUND, message: 'Not found' }, null);
    return;
  }
  callback(null, user);
}

const server = new grpc.Server();
server.addService(proto.users.UserService.service, { getUser });
server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
  console.log('User service running');
});
```

### Common Mistakes
- **Mistake**: Not setting status codes on errors.
- **Why it breaks**: Clients can't distinguish "not found" from "server error" for retry logic.
- **How to avoid**: Always use `grpc.status.*` codes.

## Step 4: Create the HTTP Gateway

```typescript
userClient.getUser({ id: req.params.id }, { deadline: Date.now() + 5000 }, (err, user) => {
  if (err) {
    if (err.code === grpc.status.NOT_FOUND) return res.status(404).json({ error: 'NOT_FOUND' });
    return res.status(500).json({ error: err.message });
  }
  res.json({ data: user });
});
```

### Common Mistakes
- **Mistake**: Not setting a deadline on gRPC calls.
- **Why it breaks**: Gateway threads hang forever if the downstream service is unresponsive.
- **How to avoid**: Always pass `{ deadline: Date.now() + timeoutMs }`.
