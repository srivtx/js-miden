import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EventStore } from '../src/store/event-store.js';
import { PlaceOrderCommand } from '../src/commands/place-order.js';
import { CancelOrderCommand } from '../src/commands/cancel-order.js';
import { OrderReadModel } from '../src/read-model/order-read-model.js';
import { OrderProjection } from '../src/projections/order-projection.js';
import { prisma } from '../src/config/index.js';

/**
 * Tests for Event Sourcing + CQRS
 * 
 * BUG TEST 1: Direct Read from Write Model
 * The OrderReadModel.getByIdFromEventStore() method queries the event store
 * directly, defeating CQRS separation.
 * 
 * BUG TEST 2: No Eventual Consistency Handling
 * After placing an order, querying the read model immediately may return null
 * because projection happens asynchronously.
 */

describe('Event Sourcing + CQRS', () => {
  let eventStore: EventStore;
  let readModel: OrderReadModel;

  beforeAll(async () => {
    eventStore = new EventStore();
    readModel = new OrderReadModel();
    
    // Clean up test data
    await prisma.orderReadModel.deleteMany();
    await prisma.eventStore.deleteMany();
    await prisma.snapshot.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Direct Read from Write Model (BUG)', () => {
    it('should allow reading directly from event store (defeats CQRS)', async () => {
      const command = new PlaceOrderCommand();
      const result = await command.execute({
        customerId: 'customer-1',
        items: [
          { productId: 'product-1', quantity: 2, unitPrice: 29.99 },
        ],
        totalAmount: 59.98,
        shippingAddress: {
          street: '123 Main St',
          city: 'Springfield',
          country: 'USA',
          zipCode: '12345',
        },
      });

      // BUG: Reading directly from event store
      const orderFromEventStore = await readModel.getByIdFromEventStore(result.aggregateId);
      
      expect(orderFromEventStore).toBeDefined();
      expect(orderFromEventStore?.aggregateId).toBe(result.aggregateId);
      expect(orderFromEventStore?.status).toBe('PENDING');
      
      // This proves the bug: we can access the write model directly
      // In proper CQRS, the read model should be the ONLY query source
    });

    it('should read from read model when available', async () => {
      const command = new PlaceOrderCommand();
      const result = await command.execute({
        customerId: 'customer-2',
        items: [
          { productId: 'product-2', quantity: 1, unitPrice: 99.99 },
        ],
        totalAmount: 99.99,
        shippingAddress: {
          street: '456 Oak Ave',
          city: 'Metropolis',
          country: 'USA',
          zipCode: '67890',
        },
      });

      // Manually trigger projection
      const projection = new OrderProjection();
      await projection.project(result.aggregateId);

      // Now read from read model
      const orderFromReadModel = await readModel.getById(result.aggregateId);
      
      expect(orderFromReadModel).toBeDefined();
      expect(orderFromReadModel?.aggregateId).toBe(result.aggregateId);
    });
  });

  describe('Eventual Consistency (BUG)', () => {
    it('should fail to find order immediately after creation (eventual consistency gap)', async () => {
      const command = new PlaceOrderCommand();
      const result = await command.execute({
        customerId: 'customer-3',
        items: [
          { productId: 'product-3', quantity: 3, unitPrice: 19.99 },
        ],
        totalAmount: 59.97,
        shippingAddress: {
          street: '789 Pine Rd',
          city: 'Gotham',
          country: 'USA',
          zipCode: '11111',
        },
      });

      // BUG: Querying read model immediately after command
      // The projection hasn't run yet, so this returns null
      const order = await readModel.getById(result.aggregateId);
      
      // This demonstrates the eventual consistency problem
      // In a proper implementation, we'd:
      // 1. Wait for projection with timeout
      // 2. Return a 202 Accepted with polling URL
      // 3. Use subscription for real-time updates
      expect(order).toBeNull();
    });

    it('should find order after projection completes', async () => {
      const command = new PlaceOrderCommand();
      const result = await command.execute({
        customerId: 'customer-4',
        items: [
          { productId: 'product-4', quantity: 1, unitPrice: 149.99 },
        ],
        totalAmount: 149.99,
        shippingAddress: {
          street: '321 Elm St',
          city: 'Star City',
          country: 'USA',
          zipCode: '22222',
        },
      });

      // Trigger projection
      const projection = new OrderProjection();
      await projection.project(result.aggregateId);

      // Now the order is available
      const order = await readModel.getById(result.aggregateId);
      
      expect(order).toBeDefined();
      expect(order?.aggregateId).toBe(result.aggregateId);
      expect(order?.status).toBe('PENDING');
    });
  });

  describe('Event Store', () => {
    it('should store and retrieve events', async () => {
      const aggregateId = 'test-aggregate-1';
      
      await eventStore.append({
        id: 'event-1',
        aggregateId,
        aggregateType: 'Order',
        eventType: 'OrderPlaced',
        eventData: { customerId: 'test' },
        version: 1,
        createdAt: new Date(),
        metadata: { correlationId: 'corr-1' },
      });

      const events = await eventStore.getEvents(aggregateId);
      
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('OrderPlaced');
      expect(events[0].version).toBe(1);
    });

    it('should replay events to rebuild state', async () => {
      const aggregateId = 'test-aggregate-2';
      
      await eventStore.append({
        id: 'event-2',
        aggregateId,
        aggregateType: 'Order',
        eventType: 'OrderPlaced',
        eventData: { customerId: 'test', status: 'PENDING' },
        version: 1,
        createdAt: new Date(),
        metadata: { correlationId: 'corr-2' },
      });

      await eventStore.append({
        id: 'event-3',
        aggregateId,
        aggregateType: 'Order',
        eventType: 'OrderCancelled',
        eventData: { reason: 'test' },
        version: 2,
        createdAt: new Date(),
        metadata: { correlationId: 'corr-3' },
      });

      const state = await eventStore.replayAggregate(aggregateId);
      
      expect(state.status).toBe('CANCELLED');
      expect(state.customerId).toBe('test');
    });
  });

  describe('Command Handlers', () => {
    it('should reject cancel on non-existent order', async () => {
      const command = new CancelOrderCommand();
      
      await expect(
        command.execute({
          aggregateId: 'non-existent',
          reason: 'test',
          cancelledBy: 'user-1',
        })
      ).rejects.toThrow('Order non-existent not found');
    });

    it('should reject cancel on already cancelled order', async () => {
      const placeCommand = new PlaceOrderCommand();
      const result = await placeCommand.execute({
        customerId: 'customer-5',
        items: [{ productId: 'p1', quantity: 1, unitPrice: 10 }],
        totalAmount: 10,
        shippingAddress: { street: 'St', city: 'City', country: 'US', zipCode: '00000' },
      });

      const cancelCommand = new CancelOrderCommand();
      await cancelCommand.execute({
        aggregateId: result.aggregateId,
        reason: 'Changed mind',
        cancelledBy: 'customer-5',
      });

      // Try to cancel again
      await expect(
        cancelCommand.execute({
          aggregateId: result.aggregateId,
          reason: 'Double cancel',
          cancelledBy: 'customer-5',
        })
      ).rejects.toThrow('Order is already cancelled');
    });
  });
});