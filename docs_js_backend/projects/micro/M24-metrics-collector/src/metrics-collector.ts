export interface MetricRecord {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}

export interface AggregatedMetrics {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
}

export class MetricsCollector {
  private metrics: Map<string, MetricRecord[]> = new Map();

  record(name: string, value: number, tags: Record<string, string> = {}): void {
    const record: MetricRecord = {
      name,
      value,
      tags,
      timestamp: Date.now(),
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(record);
  }

  getMetrics(name: string, windowMs?: number): AggregatedMetrics | null {
    // BUG: No time window filtering - returns ALL historical data
    // const cutoff = windowMs ? Date.now() - windowMs : 0;
    let records = this.metrics.get(name) || [];

    // Should filter by time window but doesn't:
    // records = records.filter(r => r.timestamp > cutoff);

    if (records.length === 0) return null;

    const values = records.map(r => r.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = values[0];
    const max = values[count - 1];
    const p95 = this.percentile(values, 0.95);
    const p99 = this.percentile(values, 0.99);

    return { count, sum, avg, min, max, p95, p99 };
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }

  getAllMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  getRawMetrics(name: string): MetricRecord[] {
    return this.metrics.get(name) || [];
  }
}
