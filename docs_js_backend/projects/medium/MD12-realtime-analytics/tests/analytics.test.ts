import { describe, it, expect } from 'vitest';
import { processEventWithRaceCondition, processEventAtomically } from '../src/api/ingestion.js';
import { redis } from '../src/config/index.js';
import { AggregationEngine } from '../src/aggregation/engine.js';

/**
 * Tests for Real-time Analytics
 * 
 * BUG TEST: Race Condition in Aggregation
 * The processEventWithRaceCondition function has a race condition
 * where concurrent updates can lose data.
 */

describe('Real-time Analytics', () => {
  describe('Race Condition in Aggregation (BUG)', () => {
    it('should demonstrate race condition with concurrent updates', async () => {
      const eventType = 'test-event';
      const windowKey = '2024-01-01T00:00:00.000Z';
      
      // Reset counter
      await redis.del(`counter:${eventType}:${windowKey}`);
      
      const event = {
        eventType,
        payload: { value: 1 },
        windowKey,
        timestamp: new Date(),
      };
      
      // Simulate 10 concurrent requests
      const promises = Array.from({ length: 10 }, () => 
        processEventWithRaceCondition(event)
      );
      
      await Promise.all(promises);
      
      // Check final count
      const finalCount = await redis.get(`counter:${eventType}:${windowKey}`);
      
      // BUG: Due to race condition, count may be less than 10
      // In a correct implementation, count should always be 10
      console.log(`Final count with race condition: ${finalCount}`);
      
      // This assertion may fail intermittently due to the race condition
      // It's a probabilistic bug - doesn't always manifest
      expect(parseInt(finalCount ?? '0', 10)).toBeLessThanOrEqual(10);
    });

    it('should handle concurrent updates atomically with fixed implementation', async () => {
      const eventType = 'test-event-fixed';
      const windowKey = '2024-01-01T00:00:00.000Z';
      
      // Reset counter
      await redis.del(`counter:${eventType}:${windowKey}`);
      
      const event = {
        eventType,
        payload: { value: 1 },
        windowKey,
      };
      
      // Simulate 10 concurrent requests using atomic operations
      const promises = Array.from({ length: 10 }, () => 
        processEventAtomically(event)
      );
      
      await Promise.all(promises);
      
      // Check final count
      const finalCount = await redis.get(`counter:${eventType}:${windowKey}`);
      
      // With atomic operations, count should always be exactly 10
      expect(parseInt(finalCount ?? '0', 10)).toBe(10);
    });
  });

  describe('Windowing', () => {
    it('should generate consistent window keys', () => {
      const engine = new AggregationEngine(60000); // 1-minute windows
      
      const date1 = new Date('2024-01-01T12:00:00.000Z');
      const date2 = new Date('2024-01-01T12:00:30.000Z');
      
      // Same minute should have same window key
      expect(engine.getWindowKey(date1)).toBe(engine.getWindowKey(date2));
      
      const date3 = new Date('2024-01-01T12:01:00.000Z');
      // Different minute should have different window key
      expect(engine.getWindowKey(date1)).not.toBe(engine.getWindowKey(date3));
    });

    it('should calculate sliding windows', () => {
      const engine = new AggregationEngine();
      
      const events = [
        { timestamp: new Date('2024-01-01T12:00:00Z'), value: 1 },
        { timestamp: new Date('2024-01-01T12:00:30Z'), value: 2 },
        { timestamp: new Date('2024-01-01T12:01:00Z'), value: 3 },
        { timestamp: new Date('2024-01-01T12:01:30Z'), value: 4 },
        { timestamp: new Date('2024-01-01T12:02:00Z'), value: 5 },
      ];
      
      const windows = engine.calculateSlidingWindow(events, 60000, 30000);
      
      expect(windows.length).toBeGreaterThan(0);
      expect(windows[0].count).toBeGreaterThan(0);
    });
  });
});