import { v4 as uuidv4 } from 'uuid';

export interface OrderPlacedEvent {
  id: string;
  aggregateId: string;
  aggregateType: 'Order';
  eventType: 'OrderPlaced';
  eventData: {
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>;
    totalAmount: number;
    shippingAddress: {
      street: string;
      city: string;
      country: string;
      zipCode: string;
    };
  };
  version: number;
  createdAt: Date;
  metadata: {
    correlationId: string;
    causationId?: string;
  };
}

export interface CreateOrderPlacedInput {
  aggregateId: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  shippingAddress: {
    street: string;
    city: string;
    country: string;
    zipCode: string;
  };
  version: number;
}

export function createOrderPlacedEvent(input: CreateOrderPlacedInput): OrderPlacedEvent {
  return {
    id: uuidv4(),
    aggregateId: input.aggregateId,
    aggregateType: 'Order',
    eventType: 'OrderPlaced',
    eventData: {
      customerId: input.customerId,
      items: input.items,
      totalAmount: input.totalAmount,
      shippingAddress: input.shippingAddress,
    },
    version: input.version,
    createdAt: new Date(),
    metadata: {
      correlationId: uuidv4(),
    },
  };
}

/**
 * Event schema version.
 * Used for migration handling when event schemas evolve.
 */
export const ORDER_PLACED_SCHEMA_VERSION = 1;

/**
 * Event upcaster for schema migrations.
 * Converts old event formats to current format.
 */
export function upcastOrderPlacedEvent(
  eventData: Record<string, unknown>,
  sourceVersion: number
): OrderPlacedEvent['eventData'] {
  if (sourceVersion === ORDER_PLACED_SCHEMA_VERSION) {
    return eventData as OrderPlacedEvent['eventData'];
  }
  
  // Handle migrations from older versions
  // This is where you'd add transformation logic
  return eventData as OrderPlacedEvent['eventData'];
}