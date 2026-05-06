# MD14 Monitoring Stack — v2 Add TypeScript

## Overview
Migrate to TypeScript and define core types: `MetricType`, `TimeSeries`, `AlertRule`, and `AlertState`. These types enforce safe metric recording and alert evaluation.

## Changes
- `tsconfig.json` with `strict: true`
- `src/types.ts`

## Code Snippet
```typescript
// src/types.ts
export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface TimeSeries {
  name: string;
  type: MetricType;
  labels: Record<string, string>;
  values: Array<{ timestamp: number; value: number }>;
}

export interface AlertRule {
  id: string;
  metricName: string;
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
```

## Rationale
- Typed metrics prevent invalid operations (e.g., decrementing a counter).
- `AlertRule` codifies the threshold + duration contract that prevents flapping.

## Trade-offs
- Histogram bucketing logic is complex; we add it in v7.

## Next Step
Add validation (v3) for metric payloads and alert rule creation.
