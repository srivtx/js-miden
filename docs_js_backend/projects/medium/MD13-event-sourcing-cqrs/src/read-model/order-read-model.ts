import { config, prisma } from '../config/index.js';
import { EventStore } from '../store/event-store.js';

/**
 * Read Model for Orders.
 * 
 * Provides query-optimized access to order data.
 * This is the "Q" in CQRS - queries go here, not to the event store.
 * 
 * BUG INTRODUCED: Direct read from write model.
 * The getByIdFromEventStore method bypasses the read model
 * and queries the event store directly. This defeats CQRS
 * because queries should not hit the write model.
 * 
 * Correct approach: Always query the read model (OrderReadModel).
 * The read model is eventually consistent but optimized for queries.
 */
export class OrderReadModel {
  private eventStore: EventStore;

  constructor() {
    this.eventStore = new EventStore();
  }

  /**
   * CORRECT: Get order from read model.
   * This is the CQRS-compliant approach.
   */
  async getById(id: string) {
    return prisma.orderReadModel.findUnique({
      where: { aggregateId: id },
    });
  }

  /**
   * BUG: Direct read from write model (event store).
   * This bypasses the read model projection and queries events directly.
   * 
   * Problems:
   * 1. Slow: Must replay all events to build state
   * 2. Not scalable: Event store is not optimized for queries
   * 3. Defeats CQRS purpose: Read and write models are mixed
   * 4. No indexes: Can't filter efficiently
   */
  async getByIdFromEventStore(id: string) {
    const events = await this.eventStore.getEvents(id);
    
    if (events.length === 0) return null;
    
    // Replay events to build current state
    let state: Record<string, unknown> = { status: 'PENDING' };
    
    for (const event of events) {
      switch (event.eventType) {
        case 'OrderPlaced':
          state = {
            ...state,
            ...event.eventData,
            status: 'PENDING',
          };
          break;
        case 'OrderCancelled':
          state = {
            ...state,
            status: 'CANCELLED',
          };
          break;
      }
    }
    
    return {
      aggregateId: id,
      ...state,
      version: events.length,
    };
  }

  /**
   * CORRECT: List orders from read model with filters.
   */
  async list(options: {
    customerId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return prisma.orderReadModel.findMany({
      where: {
        ...(options.customerId && { customerId: options.customerId }),
        ...(options.status && { status: options.status as 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' }),
      },
      take: options.limit ?? 20,
      skip: options.offset ?? 0,
      orderBy: { projectedAt: 'desc' },
    });
  }

  /**
   * CORRECT: Get order count from read model.
   */
  async count(options: { customerId?: string; status?: string } = {}) {
    return prisma.orderReadModel.count({
      where: {
        ...(options.customerId && { customerId: options.customerId }),
        ...(options.status && { status: options.status as 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' }),
      },
    });
  }
}

export { OrderReadModel as default };