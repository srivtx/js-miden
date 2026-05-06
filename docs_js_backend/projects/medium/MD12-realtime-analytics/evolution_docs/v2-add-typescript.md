# MD12 Realtime Analytics — v2 Add TypeScript

## Overview
Migrate to TypeScript and define the core domain types: `AnalyticsEvent`, `TimeWindow`, and `MetricValue`. These types will drive the ingestion API and the aggregation engine.

## Changes
- `tsconfig.json` with `strict: true`
- `src/types.ts`

## Code Snippet
```typescript
// src/types.ts
export interface AnalyticsEvent {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  source: string;
  timestamp: Date;
}

export interface TimeWindow {
  start: Date;
  end: Date;
  key: string;
}

export interface MetricValue {
  timestamp: number;
  value: number;
}
```

## Rationale
- Strong typing prevents malformed events from polluting downstream aggregations.
- `AnalyticsEvent` is the contract between producers and the ingestion API.

## Trade-offs
- Need to handle JSON serialization carefully for `payload`.

## Next Step
Add validation (v3) and the first event ingestion endpoint.
