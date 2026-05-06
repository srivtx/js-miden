# v3 — Add Validation

Your autoscaling platform receives metrics and scaling rules from external systems. Without validation, a single bad metric can trigger catastrophic scaling decisions.

## Pain #1: Metric Type Corruption

```typescript
// services/metricsService.ts (before)
function addMetric(workloadId, metricType, value) {
  metrics.push({ workloadId, metricType, value, timestamp: Date.now() });
}

// A caller sends:
addMetric('web-api', 'cpu', '95'); // string!
```

The scaling service averages `'95'` and `'90'`. String concatenation gives `'9590'`. Division by 2 gives `4795`. CPU appears to be 4795%. The scaler adds 50 nodes.

## Pain #2: Invalid Scaling Rules

```typescript
// routes/scaling.ts (before)
app.post('/rules', (req, res) => {
  const rule = req.body;
  rules.set(rule.workloadId, rule);
  // rule.scaleUpStep might be -5 (scale down on high CPU!)
  // rule.cooldownMs might be 0 (instant flapping)
});
```

A buggy dashboard sends `scaleUpStep: -5`. High CPU triggers scale-down. The workload collapses under load. Users see 503s.

## Pain #3: Negative Resource Requests

```typescript
// routes/workloads.ts (before)
app.post('/workloads', (req, res) => {
  const workload = req.body;
  workloads.set(workload.id, workload);
  // workload.cpuRequest might be -100
  // workload.minReplicas might be 100, maxReplicas might be 5
});
```

`cpuRequest: -100` breaks the cost optimizer. `minReplicas: 100, maxReplicas: 5` creates an impossible constraint. The scaler enters an infinite error loop.

## The Fix: Zod at Every Input Boundary

```typescript
// src/validation/scaling.ts
import { z } from 'zod';

export const MetricPointSchema = z.object({
  workloadId: z.string().min(1).max(256),
  type: z.enum(['cpu', 'memory', 'requests_per_second']),
  value: z.number().min(0).max(1000000),
  timestamp: z.number().int().min(0).optional().default(() => Date.now()),
});

export const ScalingRuleSchema = z.object({
  workloadId: z.string().min(1),
  scaleUpThreshold: z.number().min(1).max(100),
  scaleDownThreshold: z.number().min(1).max(100),
  scaleUpStep: z.number().int().min(1).max(100),
  scaleDownStep: z.number().int().min(1).max(100),
  cooldownMs: z.number().int().min(1000).max(600000).default(30000),
}).refine(
  (data) => data.scaleUpThreshold > data.scaleDownThreshold,
  { message: 'scaleUpThreshold must be greater than scaleDownThreshold' }
);

export const WorkloadSchema = z.object({
  id: z.string().min(1).max(256),
  cpuRequest: z.number().min(0.01).max(128),
  memoryRequest: z.number().min(1).max(1048576), // MB
  minReplicas: z.number().int().min(0).max(1000),
  maxReplicas: z.number().int().min(1).max(10000),
  currentReplicas: z.number().int().min(0).default(1),
}).refine(
  (data) => data.maxReplicas >= data.minReplicas,
  { message: 'maxReplicas must be >= minReplicas' }
);
```

```typescript
// src/routes/metrics.ts
import { MetricPointSchema } from '../validation/scaling.js';

app.post('/metrics', (req, res) => {
  const result = MetricPointSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid metric', details: result.error.issues });
  }

  const metric = result.data;
  // Guaranteed: value is a non-negative number
  // Guaranteed: type is cpu, memory, or requests_per_second
  metricsService.addMetric(metric);
  res.status(204).send();
});
```

```typescript
// src/routes/scaling.ts
import { ScalingRuleSchema, WorkloadSchema } from '../validation/scaling.js';

app.post('/rules', validateBody(ScalingRuleSchema), (req, res) => {
  const rule = req.body;
  // Guaranteed: scaleUpThreshold > scaleDownThreshold
  // Guaranteed: scaleUpStep >= 1, cooldown >= 1s
  scalingService.setRule(rule);
  res.status(201).json(rule);
});

app.post('/workloads', validateBody(WorkloadSchema), (req, res) => {
  const workload = req.body;
  // Guaranteed: maxReplicas >= minReplicas
  // Guaranteed: cpuRequest > 0, memoryRequest > 0
  scalingService.registerWorkload(workload);
  res.status(201).json(workload);
});
```

## What Changed

1. **Metric safety** — `value` is a number 0-1,000,000. No string concatenation.
2. **Rule sanity** — `scaleUpThreshold` > `scaleDownThreshold`. No inverted thresholds.
3. **Workload validity** — `maxReplicas` >= `minReplicas`. Positive resource requests.
4. **Cooldown protection** — Minimum 1 second cooldown. No instant flapping.

## Validation as Infrastructure Protection

In autoscaling, one bad metric can cost thousands of dollars in unnecessary nodes. One inverted rule can take down a production service. Validation is financial and operational protection.

## Next Pain

When scaling decisions go wrong, you have no record of why. Logs are `console.log` scattered across files. You need structured logging.
