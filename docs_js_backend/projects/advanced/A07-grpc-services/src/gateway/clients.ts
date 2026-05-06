import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadProto(path: string) {
  const packageDefinition = protoLoader.loadSync(path, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  return grpc.loadPackageDefinition(packageDefinition) as any;
}

const userProto = loadProto(join(__dirname, '../proto/user.proto'));
const orderProto = loadProto(join(__dirname, '../proto/order_v1.proto')); // BUG: Client uses v1

const USER_ADDR = process.env.USER_SERVICE_ADDR || 'localhost:50051';
const ORDER_ADDR = process.env.ORDER_SERVICE_ADDR || 'localhost:50052';

// BUG: No deadline/timeout set on clients
export const userClient = new userProto.users.UserService(
  USER_ADDR,
  grpc.credentials.createInsecure()
);

// BUG: No deadline/timeout set on clients
export const orderClient = new orderProto.orders.OrderService(
  ORDER_ADDR,
  grpc.credentials.createInsecure()
);

export function closeClients(): void {
  userClient.close();
  orderClient.close();
}
