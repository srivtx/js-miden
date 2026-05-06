import { z } from 'zod';
import { config, prisma } from '../config/index.js';
import { EventStore } from '../store/event-store.js';
import { OrderProjection } from '../projections/order-projection.js';
import { createOrderCancelledEvent } from '../events/order-cancelled.js';

const cancelOrderSchema = z.object({
  aggregateId: z.string().uuid(),
  reason: z.string().min(1).max(500),
  cancelledBy: z.string().uuid(),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

/**
 * CancelOrder command handler.
 * 
 * Business rules:
 * - Can only cancel orders in PENDING or CONFIRMED status
 * - Cannot cancel already shipped or delivered orders
 * - Records cancellation reason for audit trail
 */
export class CancelOrderCommand {
  private eventStore: EventStore;
  private projection: OrderProjection;

  constructor() {
    this.eventStore = new EventStore();
    this.projection = new OrderProjection();
  }

  async execute(input: CancelOrderInput): Promise<{ aggregateId: string; version: number }> {
    // Validate input
    const validated = cancelOrderSchema.parse(input);
    
    // Load current state from event store
    const events = await this.eventStore.getEvents(validated.aggregateId);
    
    if (events.length === 0) {
      throw new Error(`Order ${validated.aggregateId} not found`);
    }
    
    // Replay events to determine current state
    const currentState = this.replayEvents(events);
    
    // Business rule: cannot cancel shipped/delivered orders
    if (currentState.status === 'SHIPPED' || currentState.status === 'DELIVERED') {
      throw new Error(
        `Cannot cancel order in ${currentState.status} status. Only PENDING or CONFIRMED orders can be cancelled.`
      );
    }
    
    if (currentState.status === 'CANCELLED') {
      throw new Error('Order is already cancelled');
    }
    
    // Create cancellation event
    const event = createOrderCancelledEvent({
      aggregateId: validated.aggregateId,
      reason: validated.reason,
      cancelledBy: validated.cancelledBy,
      version: events.length + 1,
    });
    
    // Append to event store
    await this.eventStore.append(event);
    
    // Trigger projection update
    setImmediate(() => {
      this.projection.project(validated.aggregateId).catch((err) => {
        console.error('Projection failed:', err);
      });
    });
    
    return {
      aggregateId: validated.aggregateId,
      version: event.version,
    };
  }

  private replayEvents(events: Array<{ eventType: string; eventData: Record<string, unknown> }>): { status: string } {
    let status = 'PENDING';
    
    for (const event of events) {
      switch (event.eventType) {
        case 'OrderPlaced':
          status = 'PENDING';
          break;
        case 'OrderConfirmed':
          status = 'CONFIRMED';
          break;
        case 'OrderShipped':
          status = 'SHIPPED';
          break;
        case 'OrderDelivered':
          status = 'DELIVERED';
          break;
        case 'OrderCancelled':
          status = 'CANCELLED';
          break;
      }
    }
    
    return { status };
  }
}

export { CancelOrderCommand as default };