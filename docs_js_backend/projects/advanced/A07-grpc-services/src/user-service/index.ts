import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const packageDefinition = protoLoader.loadSync(
  join(__dirname, '../proto/user.proto'),
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);

const proto = grpc.loadPackageDefinition(packageDefinition) as any;
const UserService = proto.users.UserService;

const users: Record<string, any> = {};
let userIdCounter = 1;

function getUser(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
  const user = users[call.request.id];
  if (!user) {
    callback({ code: grpc.status.NOT_FOUND, message: 'User not found' } as grpc.ServiceError, null);
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
    call.write(user);
  }
  call.end();
}

function createUser(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
  const id = String(userIdCounter++);
  const user = {
    id,
    email: call.request.email,
    name: call.request.name,
    created_at: new Date().toISOString(),
  };
  users[id] = user;
  callback(null, user);
}

export function startUserService(port: number): grpc.Server {
  const server = new grpc.Server();
  server.addService(UserService.service, { getUser, listUsers, createUser });
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err) => {
      if (err) {
        console.error('User service failed to start:', err);
        return;
      }
      console.log(`User gRPC service running on port ${port}`);
    }
  );
  return server;
}
