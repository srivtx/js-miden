import type { Metric } from '../types/index.js';
import { logger } from '../utils/logger.js';

const store = new Map<string, Metric[]>(); // workloadId -> metrics

export function ingestMetric(metric: Metric): void {
  const list = store.get(metric.workloadId) ?? [];
  list.push(metric);
  store.set(metric.workloadId, list);
  logger.info('Metric ingested', { workloadId: metric.workloadId, name: metric.name, value: metric.value });
}

export function getMetrics(workloadId: string, windowMs = 60000): Metric[] {
  const list = store.get(workloadId) ?? [];
  const cutoff = Date.now() - windowMs;
  return list.filter(m => m.timestamp >= cutoff);
}

export function getLatestMetric(workloadId: string, name: string): Metric | undefined {
  const list = store.get(workloadId) ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].name === name) return list[i];
  }
  return undefined;
}

export function getAverageMetric(workloadId: string, name: string, windowMs = 60000): number | undefined {
  const metrics = getMetrics(workloadId, windowMs).filter(m => m.name === name);
  if (metrics.length === 0) return undefined;
  const sum = metrics.reduce((acc, m) => acc + m.value, 0);
  return sum / metrics.length;
}

export function clearMetrics(): void {
  store.clear();
}
