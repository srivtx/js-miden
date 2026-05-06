import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentStore } from '../../src/models/paymentStore.js';
import { Payment, PaymentStatus } from '../../src/types/index.js';

describe('PaymentStore', () => {
  let store: PaymentStore;

  beforeEach(() => {
    store = new PaymentStore();
  });

  it('should save and retrieve a payment', async () => {
    const payment: Payment = {
      id: '1',
      amount: 100,
      currency: 'USD',
      description: 'Test',
      status: 'pending',
      provider: null,
      providerTransactionId: null,
      idempotencyKey: 'key-1',
      customerEmail: 'test@example.com',
      metadata: {},
      attempts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      reconciledAt: null,
    };

    await store.save(payment);
    const retrieved = await store.getById('1');
    expect(retrieved).toEqual(payment);
  });

  it('should find payment by idempotency key', async () => {
    const payment: Payment = {
      id: '1',
      amount: 100,
      currency: 'USD',
      description: 'Test',
      status: 'pending',
      provider: null,
      providerTransactionId: null,
      idempotencyKey: 'unique-key',
      customerEmail: 'test@example.com',
      metadata: {},
      attempts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      reconciledAt: null,
    };

    await store.save(payment);
    const retrieved = await store.getByIdempotencyKey('unique-key');
    expect(retrieved?.id).toBe('1');
  });

  it('should find payment by provider transaction ID', async () => {
    const payment: Payment = {
      id: '1',
      amount: 100,
      currency: 'USD',
      description: 'Test',
      status: 'succeeded',
      provider: 'stripe',
      providerTransactionId: 'txn_123',
      idempotencyKey: 'key-1',
      customerEmail: 'test@example.com',
      metadata: {},
      attempts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      reconciledAt: null,
    };

    await store.save(payment);
    const retrieved = await store.getByProviderTransactionId('stripe', 'txn_123');
    expect(retrieved?.id).toBe('1');
  });

  it('should filter by status', async () => {
    const pending: Payment = {
      id: '1',
      amount: 100,
      currency: 'USD',
      description: 'Test',
      status: 'pending',
      provider: null,
      providerTransactionId: null,
      idempotencyKey: 'key-1',
      customerEmail: 'test@example.com',
      metadata: {},
      attempts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      reconciledAt: null,
    };

    const succeeded: Payment = {
      id: '2',
      amount: 200,
      currency: 'USD',
      description: 'Test 2',
      status: 'succeeded',
      provider: 'stripe',
      providerTransactionId: 'txn_456',
      idempotencyKey: 'key-2',
      customerEmail: 'test2@example.com',
      metadata: {},
      attempts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      reconciledAt: null,
    };

    await store.save(pending);
    await store.save(succeeded);

    const succeededPayments = await store.getByStatus('succeeded');
    expect(succeededPayments).toHaveLength(1);
    expect(succeededPayments[0].id).toBe('2');
  });

  it('should filter by date range', async () => {
    const oldPayment: Payment = {
      id: '1',
      amount: 100,
      currency: 'USD',
      description: 'Old',
      status: 'succeeded',
      provider: 'stripe',
      providerTransactionId: 'txn_1',
      idempotencyKey: 'key-1',
      customerEmail: 'test@example.com',
      metadata: {},
      attempts: [],
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
      reconciledAt: null,
    };

    const newPayment: Payment = {
      id: '2',
      amount: 200,
      currency: 'USD',
      description: 'New',
      status: 'succeeded',
      provider: 'stripe',
      providerTransactionId: 'txn_2',
      idempotencyKey: 'key-2',
      customerEmail: 'test2@example.com',
      metadata: {},
      attempts: [],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      reconciledAt: null,
    };

    await store.save(oldPayment);
    await store.save(newPayment);

    const results = await store.getByDateRange(
      new Date('2023-01-01'),
      new Date('2024-12-31')
    );
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('2');
  });
});
