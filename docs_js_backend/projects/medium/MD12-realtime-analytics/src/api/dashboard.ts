import { Router } from 'express';
import { config, prisma } from '../config/index.js';
import { redis } from '../config/index.js';
import { AggregationEngine } from '../aggregation/engine.js';

const router = Router();
const aggregationEngine = new AggregationEngine();

/**
 * GET /metrics
 * Returns current metrics across all event types.
 */
router.get('/', async (req, res, next) => {
  try {
    const { eventType, window } = req.query as { eventType?: string; window?: string };
    const windowKey = window ?? aggregationEngine.getWindowKey(new Date());
    
    const eventTypes = eventType 
      ? [eventType]
      : await redis.smembers('event:types');
    
    const metrics = await Promise.all(
      eventTypes.map(async (type) => {
        const counterKey = `counter:${type}:${windowKey}`;
        const rateKey = `rate:${type}`;
        const sumKey = `sum:${type}:${windowKey}`;
        
        const [count, rate, sum] = await Promise.all([
          redis.get(counterKey),
          redis.get(rateKey),
          redis.get(sumKey),
        ]);
        
        return {
          eventType: type,
          window: windowKey,
          count: parseInt(count ?? '0', 10),
          ratePerSecond: parseInt(rate ?? '0', 10),
          sum: parseFloat(sum ?? '0'),
          timestamp: new Date().toISOString(),
        };
      })
    );
    
    res.json({ metrics, window: windowKey });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /metrics/timeseries
 * Returns time-series data for the last N hours.
 */
router.get('/timeseries', async (req, res, next) => {
  try {
    const { eventType, hours = '24' } = req.query as { eventType: string; hours?: string };
    
    if (!eventType) {
      return res.status(400).json({ error: 'eventType query parameter is required' });
    }
    
    const hoursNum = Math.min(parseInt(hours, 10), 168); // Max 1 week
    const now = new Date();
    const windowKeys: string[] = [];
    
    for (let i = 0; i < hoursNum; i++) {
      const time = new Date(now.getTime() - i * 3600000);
      windowKeys.push(aggregationEngine.getWindowKey(time));
    }
    
    const series = await Promise.all(
      windowKeys.map(async (windowKey) => {
        const counterKey = `counter:${eventType}:${windowKey}`;
        const count = await redis.get(counterKey);
        return {
          window: windowKey,
          count: parseInt(count ?? '0', 10),
        };
      })
    );
    
    // Also get from PostgreSQL for historical data
    const historicalData = await prisma.metricRollup.findMany({
      where: {
        metricName: eventType,
        windowStart: {
          gte: new Date(now.getTime() - hoursNum * 3600000),
        },
      },
      orderBy: { windowStart: 'asc' },
    });
    
    res.json({
      eventType,
      realTime: series.reverse(),
      historical: historicalData,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /metrics/rates
 * Returns current event rates.
 */
router.get('/rates', async (req, res, next) => {
  try {
    const eventTypes = await redis.smembers('event:types');
    
    const rates = await Promise.all(
      eventTypes.map(async (type) => {
        const rateKey = `rate:${type}`;
        const rate = await redis.get(rateKey);
        return {
          eventType: type,
          eventsPerSecond: parseInt(rate ?? '0', 10),
        };
      })
    );
    
    res.json({ rates });
  } catch (error) {
    next(error);
  }
});

export { router as dashboardRouter };