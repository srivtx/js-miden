# MD14 Monitoring Stack — v4 Add Logging

## Overview
Replace `console.log` with Pino and add the alert evaluation engine. Logs record every metric ingestion, alert state transition, and retention pruning run.

## Changes
- Add `pino`, `pino-http`.
- Create `src/services/alertEngine.ts`.
- Log alert triggers and resolves.

## Code Snippet
```typescript
// src/services/alertEngine.ts
import { queryTimeSeries } from './metricStore.js';
import { logger } from '../config/logger.js';

export function evaluateRules() {
  for (const rule of rules) {
    const series = queryTimeSeries(rule.metricName, rule.labels);
    const latest = series.flatMap(s => s.values).sort((a, b) => b.timestamp - a.timestamp)[0];
    const currentValue = latest?.value ?? 0;
    const triggered = rule.condition === 'gt' ? currentValue > rule.threshold : false;

    // BUG for education: immediate toggle without duration/hysteresis
    if (triggered) {
      alertStates.set(rule.id, { ruleId: rule.id, active: true, triggeredAt: Date.now(), currentValue });
      logger.warn({ ruleId: rule.id, currentValue }, 'alert_triggered');
    } else {
      const state = alertStates.get(rule.id);
      if (state) {
        alertStates.set(rule.id, { ...state, active: false, resolvedAt: Date.now(), currentValue });
        logger.info({ ruleId: rule.id }, 'alert_resolved');
      }
    }
  }
}
```

## Rationale
- Structured logs make it easy to search for `alert_triggered` in Kibana/Loki.
- The immediate toggle above is intentionally buggy; it demonstrates flapping and is fixed in v7.

## Trade-offs
- Logging every metric at high throughput is expensive; sampling is added in v7.

## Next Step
Add tests (v5) to assert metric storage, alert evaluation, and flapping behavior.
