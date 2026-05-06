import { v4 as uuidv4 } from 'uuid';

export interface OrderCancelledEvent {
  id: string;
  aggregateId: string;
  aggregateType: 'Order';
  eventType: 'OrderCancelled';
  eventData: {
    reason: string;
    cancelledBy: string;
    cancelledAt: Date;
  };
  version: number;
  createdAt: Date;
  metadata: {
    correlationId: string;
    causationId?: string;
  };
}

export interface CreateOrderCancelledInput {
  aggregateId: string;
  reason: string;
  cancelledBy: string;
  version: number;
}

export function createOrderCancelledEvent(input: CreateOrderCancelledInput): OrderCancelledEvent {
  return {
    id: uuidv4(),
    aggregateId: input.aggregateId,
    aggregateType: 'Order',
    eventType: 'OrderCancelled',
    eventData: {
      reason: input.reason,
      cancelledBy: input.cancelledBy,
      cancelledAt: new Date(),
    },
    version: input.version,
    createdAt: new Date(),
    metadata: {
      correlationId: uuidv4(),
    },
  };
}

export const ORDER_CANCELLED_SCHEMA_VERSION = 1;

export function upcastOrderCancelledEvent(
  eventData: Record<string, unknown>,
  sourceVersion: number
): OrderCancelledEvent['eventData'] {
  if (sourceVersion === ORDER_CANCELLED_SCHEMA_VERSION) {
    return eventData as OrderCancelledEvent['eventData'];
  }
  return eventData as OrderCancelledEvent['eventData'];
}