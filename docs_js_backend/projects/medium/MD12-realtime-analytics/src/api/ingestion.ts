import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { config, prisma } from '../config/index.js';
import { redis } from '../config/index.js';
import { AggregationEngine } from '../aggregation/engine.js';

const router = Router();
const aggregationEngine = new AggregationEngine();

const eventSchema = z.object({
  eventType: z.string().min(1).max(100),
  payload: z.record(z.unknown()).default({}),
  source: z.string().min(1).max(200).default('api'),
  timestamp: z.string().datetime().optional(),
});

/**
 * POST /events
 * Ingest a single event or batch of events.
 * 
 * BUG INTRODUCED: Race condition in aggregation.
 * The Redis INCR and HINCRBY operations are not atomic when combined
 * with read-modify-write patterns for complex metrics like averages.
 * Two simultaneous events can read the same counter value,
 * increment it, and write back - one update is lost.
 */
router.post('/', async (req, res, next) => {
  try {
    const rawEvents = Array.isArray(req.body) ? req.body : [req.body];
    
    if (rawEvents.length > config.eventBatchSize) {
      return res.status(400).json({
        error: `Batch size exceeds maximum of ${config.eventBatchSize}`,
      });
    }

    const validatedEvents = rawEvents.map((raw) => eventSchema.parse(raw));
    const events = validatedEvents.map((event) => ({
      id: uuidv4(),
      eventType: event.eventType,
      payload: event.payload,
      source: event.source,
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      windowKey: aggregationEngine.getWindowKey(new Date()),
    }));

    // Store events in PostgreSQL
    await prisma.event.createMany({
      data: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        payload: e.payload as Record<string, unknown>,
        source: e.source,
        timestamp: e.timestamp,
        windowKey: e.windowKey,
      })),
    });

    // BUG: Race condition here!
    // Process each event without atomic operations
    for (const event of events) {
      await processEventWithRaceCondition(event);
    }

    res.status(201).json({
      ingested: events.length,
      eventIds: events.map((e) => e.id),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Process event with intentional race condition.
 * Reads current value, modifies, writes back - not atomic.
 */
async function processEventWithRaceCondition(event: {
  eventType: string;
  payload: Record<string, unknown>;
  windowKey: string;
  timestamp: Date;
}): Promise<void> {
  const counterKey = `counter:${event.eventType}:${event.windowKey}`;
  const rateKey = `rate:${event.eventType}`;
  
  // BUG: Non-atomic read-modify-write
  // Two concurrent requests can read the same value simultaneously
  const currentCount = await redis.get(counterKey);
  const newCount = (parseInt(currentCount ?? '0', 10)) + 1;
  await redis.set(counterKey, newCount.toString());
  await redis.expire(counterKey, config.metricsRetentionHours * 3600);

  // Also update rate counter (same race condition)
  const currentRate = await redis.get(rateKey);
  const newRate = (parseInt(currentRate ?? '0', 10)) + 1;
  await redis.set(rateKey, newRate.toString());
  await redis.expire(rateKey, 60);

  // For numeric payload values, update aggregates with same race condition
  if (typeof event.payload.value === 'number') {
    const avgKey = `avg:${event.eventType}:${event.windowKey}`;
    const sumKey = `sum:${event.eventType}:${event.windowKey}`;
    
    const currentSum = await redis.get(sumKey);
    const newSum = (parseFloat(currentSum ?? '0')) + event.payload.value;
    await redis.set(sumKey, newSum.toString());
    
    // BUG: Average calculation is also racy
    const newAvg = newSum / newCount;
    await redis.set(avgKey, newAvg.toString());
  }
}

/**
 * Fixed version using Redis Lua scripts for atomic operations.
 * This is the correct implementation that prevents race conditions.
 */
export async function processEventAtomically(event: {
  eventType: string;
  payload: Record<string, unknown>;
  windowKey: string;
}): Promise<void> {
  const counterKey = `counter:${event.eventType}:${event.windowKey}`;
  const rateKey = `rate:${event.eventType}`;
  
  // Use Redis INCR which is atomic
  await redis.incr(counterKey);
  await redis.expire(counterKey, config.metricsRetentionHours * 3600);
  
  await redis.incr(rateKey);
  await redis.expire(rateKey, 60);
  
  if (typeof event.payload.value === 'number') {
    const sumKey = `sum:${event.eventType}:${event.windowKey}`;
    await redis.incrbyfloat(sumKey, event.payload.value);
    
    // Calculate average on read, not write
    // Or use Redis sorted sets for proper statistical aggregates
  }
}

export { router as eventRouter };