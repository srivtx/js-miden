export interface Labels {
  [key: string]: string;
}

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricValue {
  timestamp: number;
  value: number;
}

export interface TimeSeries {
  name: string;
  type: MetricType;
  labels: Labels;
  values: MetricValue[];
}

export interface HistogramBucket {
  upperBound: number;
  count: number;
}

export interface HistogramSnapshot {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

export interface AlertRule {
  id: string;
  name: string;
  metricName: string;
  labels: Labels;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  durationMs: number;
  severity: 'warning' | 'critical';
}

export interface AlertState {
  ruleId: string;
  active: boolean;
  triggeredAt?: number;
  resolvedAt?: number;
  currentValue: number;
}
