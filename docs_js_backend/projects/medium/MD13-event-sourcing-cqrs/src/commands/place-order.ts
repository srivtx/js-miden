import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { config, prisma } from '../config/index.js';
import { EventStore } from '../store/event-store.js';
import { OrderProjection } from '../projections/order-projection.js';
import { createOrderPlacedEvent } from '../events/order-placed.js';

const placeOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
    })
  ).min(1),
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    country: z.string().min(1),
    zipCode: z.string().min(1),
  }),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

/**
 * PlaceOrder command handler.
 * 
 * In CQRS, commands modify state and emit events.
 * The command handler:
 * 1. Validates the command
 * 2. Loads the aggregate (or creates new)
 * 3. Applies business logic
 * 4. Emits events to the event store
 * 5. Triggers projection updates (async)
 * 
 * Reference:
 * - Young, G. (2010). "CQRS, Task Based UIs, Event Sourcing agh!"
 * - Vernon, V. (2013). "Implementing Domain-Driven Design"
 */
export class PlaceOrderCommand {
  private eventStore: EventStore;
  private projection: OrderProjection;

  constructor() {
    this.eventStore = new EventStore();
    this.projection = new OrderProjection();
  }

  async execute(input: PlaceOrderInput): Promise<{ aggregateId: string; version: number }> {
    // Validate input
    const validated = placeOrderSchema.parse(input);
    
    // Generate aggregate ID
    const aggregateId = uuidv4();
    
    // Calculate total
    const totalAmount = validated.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    
    // Create event
    const event = createOrderPlacedEvent({
      aggregateId,
      customerId: validated.customerId,
      items: validated.items,
      totalAmount,
      shippingAddress: validated.shippingAddress,
      version: 1,
    });
    
    // Append to event store (write model)
    await this.eventStore.append(event);
    
    // Trigger projection update (async - eventual consistency)
    // In production, this would be done via message bus
    setImmediate(() => {
      this.projection.project(aggregateId).catch((err) => {
        console.error('Projection failed:', err);
      });
    });
    
    return {
      aggregateId,
      version: event.version,
    };
  }
}

export { PlaceOrderCommand as default };