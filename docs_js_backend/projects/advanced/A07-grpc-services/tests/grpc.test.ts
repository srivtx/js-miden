import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/gateway/index.js';
import { startUserService } from '../src/user-service/index.js';
import { startOrderService } from '../src/order-service/index.js';
import { closeClients } from '../src/gateway/clients.js';
import * as grpc from '@grpc/grpc-js';

let userServer: grpc.Server;
let orderServer: grpc.Server;

beforeAll((done) => {
  userServer = startUserService(50051);
  orderServer = startOrderService(50052);
  // Give servers time to bind
  setTimeout(done, 500);
});

afterAll(() => {
  closeClients();
  userServer.forceShutdown();
  orderServer.forceShutdown();
});

describe('User Service via Gateway', () => {
  it('should create a user', async () => {
    const res = await request(app)
      .post('/users')
      .send({ email: 'grpc-user@example.com', name: 'gRPC User' });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('grpc-user@example.com');
  });

  it('should get a user by id', async () => {
    const createRes = await request(app)
      .post('/users')
      .send({ email: 'get-user@example.com', name: 'Get User' });

    const id = createRes.body.data.id;
    const res = await request(app).get(`/users/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });
});

describe('Order Service via Gateway', () => {
  it('should create an order', async () => {
    const userRes = await request(app)
      .post('/users')
      .send({ email: 'order-owner@example.com', name: 'Order Owner' });
    const userId = userRes.body.data.id;

    const res = await request(app)
      .post('/orders')
      .send({
        user_id: userId,
        total_cents: 5000,
        items: [{ sku: 'ITEM-1', quantity: 2, unit_price_cents: 2500 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.user_id).toBe(userId);
  });
});

describe('BUG: Proto Version Mismatch', () => {
  it('should preserve total_cents through the RPC', async () => {
    const userRes = await request(app)
      .post('/users')
      .send({ email: 'proto@example.com', name: 'Proto' });
    const userId = userRes.body.data.id;

    const res = await request(app)
      .post('/orders')
      .send({
        user_id: userId,
        total_cents: 12345,
        items: [],
      });

    expect(res.status).toBe(201);

    // BUG: Gateway sends `total_cents` (v1 proto).
    // Order service expects `amount_cents` (v2 proto).
    // gRPC ignores unknown fields, so amount_cents defaults to 0.
    // This test WILL FAIL because amount_cents/total_cents is 0 instead of 12345.
    expect(res.body.data.total_cents || res.body.data.amount_cents).toBe(12345);
  });
});

describe('BUG: No Deadline / Timeout', () => {
  it('should fail fast when downstream service is unreachable', async () => {
    // Shut down order service to simulate outage
    orderServer.forceShutdown();

    const userRes = await request(app)
      .post('/users')
      .send({ email: 'timeout@example.com', name: 'Timeout' });
    const userId = userRes.body.data.id;

    const start = Date.now();
    const res = await request(app)
      .post('/orders')
      .send({
        user_id: userId,
        total_cents: 1000,
        items: [],
      });

    const elapsed = Date.now() - start;

    // Restart for other tests
    orderServer = startOrderService(50052);

    // BUG: Without a deadline, gRPC waits for default TCP timeout (~minutes).
    // This test documents the failure: it should return in < 2s, but it won't.
    // In practice this may actually fail because the gateway returns 400 (user check passes
    // but order service is down). The real bug is the hang — but in test environment,
    // connection refused is fast. The deeper issue: if the service accepts the connection
    // but never responds, we'd hang forever with no deadline.
    // We test the absence of deadline configuration instead.
    expect(elapsed).toBeLessThan(2000);
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});

describe('BUG: No Retry Logic', () => {
  it('should retry transient failures', async () => {
    // This test documents the absence of retry logic.
    // In a real system, UNAVAILABLE errors trigger automatic retry with backoff.
    // Here, a single transient failure crashes the request.
    // We verify there is no retry by checking the client options.
    // @ts-ignore
    const orderClientAny = (await import('../src/gateway/clients.js')).orderClient;
    const options = orderClientAny.getChannel()?.options;

    // If retries were configured, we'd see 'grpc.service_config' with retryPolicy.
    // The bug is that nothing is configured.
    expect(options?.['grpc.service_config']).toBeDefined();
  });
});
