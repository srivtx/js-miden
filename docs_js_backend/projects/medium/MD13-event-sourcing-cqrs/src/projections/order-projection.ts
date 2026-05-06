import { config, prisma } from '../config/index.js';
import { EventStore } from '../store/event-store.js';

/**
 * Order Projection - Read Model
 * 
 * In CQRS, the read model is built from events via projections.
 * It is optimized for queries and is eventually consistent
 * with the write model (event store).
 * 
 * The projection:
 * 1. Loads all events for an aggregate
 * 2. Replays them to build current state
 * 3. Persists to the read model database
 * 
 * Reference:
 * - Betts, D., et al. (2013). "Exploring CQRS and Event Sourcing"
 * - Microsoft Patterns & Practices (2013)
 */
export class OrderProjection {
  private eventStore: EventStore;

  constructor() {
    this.eventStore = new EventStore();
  }

  /**
   * Project an aggregate's state to the read model.
   * Called asynchronously after command execution.
   */
  async project(aggregateId: string): Promise<void> {
    const events = await this.eventStore.getEvents(aggregateId);
    
    if (events.length === 0) return;
    
    // Replay events to build state
    const state = this.replayEvents(aggregateId, events);
    
    // Upsert to read model
    await prisma.orderReadModel.upsert({
      where: { aggregateId },
      create: {
        aggregateId,
        customerId: state.customerId as string,
        status: state.status as 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED',
        totalAmount: state.totalAmount as number,
        items: state.items as unknown[],
        shippingAddress: state.shippingAddress as Record<string, unknown>,
        version: events.length,
        projectedAt: new Date(),
      },
      update: {
        status: state.status as 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED',
        totalAmount: state.totalAmount as number,
        items: state.items as unknown[],
        shippingAddress: state.shippingAddress as Record<string, unknown>,
        version: events.length,
        projectedAt: new Date(),
      },
    });
  }

  /**
   * Rebuild the entire read model from events.
   * Useful for recovery or schema changes.
   */
  async rebuildAll(): Promise<{ projected: number }> {
    const allEvents = await prisma.eventStore.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        aggregateId: true,
        eventType: true,
        eventData: true,
        version: true,
      },
    });

    // Group by aggregate
    const aggregateEvents = new Map<string, typeof allEvents>();
    for (const event of allEvents) {
      const list = aggregateEvents.get(event.aggregateId) ?? [];
      list.push(event);
      aggregateEvents.set(event.aggregateId, list);
    }

    // Project each aggregate
    for (const [aggregateId, events] of aggregateEvents) {
      const state = this.replayEvents(aggregateId, events);
      
      await prisma.orderReadModel.upsert({
        where: { aggregateId },
        create: {
          aggregateId,
          customerId: state.customerId as string,
          status: state.status as 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED',
          totalAmount: state.totalAmount as number,
          items: state.items as unknown[],
          shippingAddress: state.shippingAddress as Record<string, unknown>,
          version: events.length,
          projectedAt: new Date(),
        },
        update: {
          status: state.status as 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED',
          totalAmount: state.totalAmount as number,
          items: state.items as unknown[],
          shippingAddress: state.shippingAddress as Record<string, unknown>,
          version: events.length,
          projectedAt: new Date(),
        },
      });
    }

    return { projected: aggregateEvents.size };
  }

  private replayEvents(
    aggregateId: string,
    events: Array<{ eventType: string; eventData: Record<string, unknown>; version: number }>
  ): Record<string, unknown> {
    let state: Record<string, unknown> = { aggregateId, status: 'PENDING' };
    
    for (const event of events) {
      switch (event.eventType) {
        case 'OrderPlaced':
          state = {
            ...state,
            customerId: event.eventData.customerId,
            items: event.eventData.items,
            totalAmount: event.eventData.totalAmount,
            shippingAddress: event.eventData.shippingAddress,
            status: 'PENDING',
          };
          break;
        case 'OrderCancelled':
          state = {
            ...state,
            status: 'CANCELLED',
            cancelledReason: event.eventData.reason,
            cancelledBy: event.eventData.cancelledBy,
            cancelledAt: event.eventData.cancelledAt,
          };
          break;
      }
    }
    
    return state;
  }
}

export { OrderProjection as default };