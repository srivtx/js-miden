import { describe, it, expect, beforeEach } from 'vitest';
import { ingestMetric, getMetrics, getAverageMetric, clearMetrics } from '../../src/services/metricsService.js';

beforeEach(() => clearMetrics());

describe('metricsService', () => {
  it('ingests and retrieves metrics', () => {
    ingestMetric({ workloadId: 'wl-1', name: 'cpu', value: 55, timestamp: Date.now() });
    const metrics = getMetrics('wl-1');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].value).toBe(55);
  });

  it('calculates average over window', () => {
    const now = Date.now();
    ingestMetric({ workloadId: 'wl-1', name: 'cpu', value: 40, timestamp: now - 1000 });
    ingestMetric({ workloadId: 'wl-1', name: 'cpu', value: 60, timestamp: now });
    const avg = getAverageMetric('wl-1', 'cpu', 5000);
    expect(avg).toBe(50);
  });
});
