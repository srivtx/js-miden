import { config, prisma } from '../config/index.js';
import type { OrderPlacedEvent } from '../events/order-placed.js';
import type { OrderCancelledEvent } from '../events/order-cancelled.js';

export type DomainEvent = OrderPlacedEvent | OrderCancelledEvent;

/**
 * Event Store implementation using PostgreSQL.
 * 
 * The event store is the single source of truth in event sourcing.
 * It provides:
 * - Append-only log of all domain events
 * - Optimistic concurrency control (versioning)
 * - Event replay capability
 * - Snapshot support for performance
 * 
 * Reference:
 * - Fowler, M. (2005). "Event Sourcing"
 * - Vernon, V. (2013). "Implementing Domain-Driven Design"
 */
export class EventStore {
  /**
   * Append a single event to the store.
   * Uses optimistic concurrency control via version number.
   */
  async append(event: DomainEvent): Promise<void> {
    await prisma.eventStore.create({
      data: {
        id: event.id,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        eventData: event.eventData as Record<string, unknown>,
        version: event.version,
        createdAt: event.createdAt,
        metadata: event.metadata as Record<string, unknown> | undefined,
      },
    });
  }

  /**
   * Get all events for an aggregate.
   * Ordered by version for deterministic replay.
   */
  async getEvents(aggregateId: string): Promise<Array<{ eventType: string; eventData: Record<string, unknown>; version: number }>> {
    const events = await prisma.eventStore.findMany({
      where: { aggregateId },
      orderBy: { version: 'asc' },
      select: {
        eventType: true,
        eventData: true,
        version: true,
      },
    });
    
    return events;
  }

  /**
   * Get events for an aggregate starting from a specific version.
   * Used for snapshot-based replay.
   */
  async getEventsFromVersion(
    aggregateId: string,
    fromVersion: number
  ): Promise<Array<{ eventType: string; eventData: Record<string, unknown>; version: number }>> {
    const events = await prisma.eventStore.findMany({
      where: {
        aggregateId,
        version: { gt: fromVersion },
      },
      orderBy: { version: 'asc' },
      select: {
        eventType: true,
        eventData: true,
        version: true,
      },
    });
    
    return events;
  }

  /**
   * Get all events of a specific type.
   * Useful for building projections.
   */
  async getEventsByType(eventType: string): Promise<Array<{ aggregateId: string; eventData: Record<string, unknown>; version: number }>> {
    const events = await prisma.eventStore.findMany({
      where: { eventType },
      orderBy: { createdAt: 'asc' },
      select: {
        aggregateId: true,
        eventData: true,
        version: true,
      },
    });
    
    return events;
  }

  /**
   * Get the current version for an aggregate.
   */
  async getCurrentVersion(aggregateId: string): Promise<number> {
    const lastEvent = await prisma.eventStore.findFirst({
      where: { aggregateId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    
    return lastEvent?.version ?? 0;
  }

  /**
   * Create a snapshot of an aggregate state.
   * Snapshots improve replay performance for aggregates with many events.
   */
  async createSnapshot(aggregateId: string, state: Record<string, unknown>, version: number): Promise<void> {
    await prisma.snapshot.create({
      data: {
        aggregateId,
        aggregateType: 'Order',
        state,
        version,
      },
    });
  }

  /**
   * Get the latest snapshot for an aggregate.
   */
  async getLatestSnapshot(aggregateId: string): Promise<{ state: Record<string, unknown>; version: number } | null> {
    const snapshot = await prisma.snapshot.findFirst({
      where: { aggregateId },
      orderBy: { version: 'desc' },
      select: {
        state: true,
        version: true,
      },
    });
    
    return snapshot;
  }

  /**
   * Replay all events to rebuild state.
   * This is the core of event sourcing - the ability to rebuild state
   * from the event log at any point in time.
   */
  async replayAggregate(aggregateId: string): Promise<Record<string, unknown>> {
    const snapshot = await this.getLatestSnapshot(aggregateId);
    
    let state: Record<string, unknown> = snapshot?.state ?? {};
    const fromVersion = snapshot?.version ?? 0;
    
    const events = await this.getEventsFromVersion(aggregateId, fromVersion);
    
    for (const event of events) {
      state = this.applyEvent(state, event);
    }
    
    return state;
  }

  private applyEvent(
    state: Record<string, unknown>,
    event: { eventType: string; eventData: Record<string, unknown> }
  ): Record<string, unknown> {
    switch (event.eventType) {
      case 'OrderPlaced':
        return {
          ...state,
          status: 'PENDING',
          ...event.eventData,
        };
      case 'OrderCancelled':
        return {
          ...state,
          status: 'CANCELLED',
          cancelledReason: event.eventData.reason,
          cancelledBy: event.eventData.cancelledBy,
          cancelledAt: event.eventData.cancelledAt,
        };
      default:
        return state;
    }
  }
}

export { EventStore as default };