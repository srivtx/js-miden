import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const packageDefinition = protoLoader.loadSync(
  join(__dirname, '../proto/order.proto'),
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);

const proto = grpc.loadPackageDefinition(packageDefinition) as any;
const OrderService = proto.orders.OrderService;

const orders: Record<string, any> = {};
let orderIdCounter = 1;

function createOrder(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
  const id = String(orderIdCounter++);
  // Server expects amount_cents (v2 proto)
  const amountCents = call.request.total_cents || call.request.amount_cents || 0;
  const order = {
    id,
    user_id: call.request.user_id,
    amount_cents: amountCents,
    status: 'pending',
    items: call.request.items || [],
    created_at: new Date().toISOString(),
  };
  orders[id] = order;
  callback(null, order);
}

function getOrder(call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) {
  const order = orders[call.request.id];
  if (!order) {
    callback({ code: grpc.status.NOT_FOUND, message: 'Order not found' } as grpc.ServiceError, null);
    return;
  }
  callback(null, order);
}

function listUserOrders(call: grpc.ServerWritableStream<any, any>) {
  const userOrders = Object.values(orders).filter((o: any) => o.user_id === call.request.user_id);
  for (const order of userOrders) {
    call.write(order);
  }
  call.end();
}

export function startOrderService(port: number): grpc.Server {
  const server = new grpc.Server();
  server.addService(OrderService.service, { createOrder, getOrder, listUserOrders });
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(),
    (err) => {
      if (err) {
        console.error('Order service failed to start:', err);
        return;
      }
      console.log(`Order gRPC service running on port ${port}`);
    }
  );
  return server;
}
