import { describe, it, expect } from 'vitest';
import { simpleMovingAverage, linearRegressionForecast } from '../../src/services/predictiveScaling.js';
import type { TimeSeriesPoint } from '../../src/types/index.js';

describe('predictiveScaling', () => {
  it('computes simple moving average', () => {
    const points: TimeSeriesPoint[] = [
      { timestamp: 0, value: 10 },
      { timestamp: 1, value: 20 },
      { timestamp: 2, value: 30 },
    ];
    expect(simpleMovingAverage(points, 2)).toBe(25);
  });

  it('forecasts with linear regression', () => {
    const points: TimeSeriesPoint[] = [
      { timestamp: 0, value: 0 },
      { timestamp: 1, value: 1 },
      { timestamp: 2, value: 2 },
    ];
    const forecast = linearRegressionForecast(points);
    expect(forecast).toBeCloseTo(3, 1);
  });
});
