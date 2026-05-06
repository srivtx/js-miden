import type { TimeSeriesPoint } from '../types/index.js';

export function simpleMovingAverage(points: TimeSeriesPoint[], window: number): number | undefined {
  if (points.length < window) return undefined;
  const slice = points.slice(-window);
  const sum = slice.reduce((acc, p) => acc + p.value, 0);
  return sum / window;
}

export function linearRegressionForecast(points: TimeSeriesPoint[]): number | undefined {
  if (points.length < 2) return undefined;
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  const firstTs = points[0].timestamp;
  for (const p of points) {
    const x = p.timestamp - firstTs;
    const y = p.value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return undefined;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const nextX = points[n - 1].timestamp - firstTs + (points[1].timestamp - points[0].timestamp);
  return slope * nextX + intercept;
}
