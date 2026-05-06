import type { Labels, MetricType, TimeSeries, MetricValue } from '../types.js';

// In-memory time-series database
const timeSeriesMap = new Map<string, TimeSeries>();

function seriesKey(name: string, labels: Labels): string {
  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(',');
  return `${name}{${labelStr}}`;
}

export function recordMetric(
  name: string,
  type: MetricType,
  value: number,
  labels: Labels = {},
  timestamp: number = Date.now()
): void {
  const key = seriesKey(name, labels);
  let ts = timeSeriesMap.get(key);

  if (!ts) {
    ts = { name, type, labels, values: [] };
    timeSeriesMap.set(key, ts);
  }

  // BUG: No cardinality limits — user can create millions of unique label combos
  // (e.g., putting userId or requestId into labels)

  ts.values.push({ timestamp, value });

  // BUG: No retention policy — data grows forever in memory
  // A real system would drop old data here based on retention_hours
}

export function getTimeSeries(name: string, labels: Labels = {}): TimeSeries | undefined {
  const key = seriesKey(name, labels);
  return timeSeriesMap.get(key);
}

export function queryTimeSeries(
  name: string,
  labelMatcher: Labels = {}
): TimeSeries[] {
  const results: TimeSeries[] = [];
  for (const ts of timeSeriesMap.values()) {
    if (ts.name !== name) continue;
    const matches = Object.entries(labelMatcher).every(
      ([k, v]) => ts.labels[k] === v
    );
    if (matches) results.push(ts);
  }
  return results;
}

export function getAllSeries(): TimeSeries[] {
  return Array.from(timeSeriesMap.values());
}

export function getSeriesCount(): number {
  return timeSeriesMap.size;
}

export function clearStore(): void {
  timeSeriesMap.clear();
}

export function pruneOldData(retentionHours: number): void {
  const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
  for (const ts of timeSeriesMap.values()) {
    ts.values = ts.values.filter((v) => v.timestamp >= cutoff);
  }
  // Remove empty series
  for (const [key, ts] of timeSeriesMap.entries()) {
    if (ts.values.length === 0) timeSeriesMap.delete(key);
  }
}
