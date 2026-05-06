# v2 — Add TypeScript

Your autoscaling platform evaluates metrics, makes scaling decisions, and optimizes costs. JavaScript's loose typing is causing wrong decisions and wasted money.

## Pain #1: Metric Type Confusion

```js
// services/metricsService.js
function addMetric(workloadId, metricType, value) {
  metrics.push({ workloadId, metricType, value, timestamp: Date.now() });
}

function getAverageMetric(workloadId, metricType, windowMs) {
  const values = metrics
    .filter(m => m.workloadId === workloadId && m.metricType === metricType)
    .map(m => m.value);
  
  return values.reduce((a, b) => a + b, 0) / values.length;
}
```

A caller passes `value: '85'` (string). `reduce` does string concatenation: `'85' + '90' = '8590'`. Division by count gives `4295`. The scaler thinks CPU is 4295% and adds 50 nodes.

## Pain #2: Scaling Decision Ambiguity

```js
// services/scalingService.js
function evaluateScaling(workload, rule) {
  // Returns { action: 'scale_up' | 'scale_down' | 'none', targetReplicas }
  // But sometimes returns { action: 'scale_up', reason: 'CPU high' }
  // Missing targetReplicas! The controller crashes.
}
```

The controller receives a decision without `targetReplicas`. It tries to scale to `undefined`. The API returns 500. The workload stays at its current size while traffic surges.

## Pain #3: Workload Config Drift

```js
// routes/scaling.js
app.post('/workloads', (req, res) => {
  const workload = {
    id: req.body.id,
    cpuRequest: req.body.cpu,
    memoryRequest: req.body.memory,
    minReplicas: req.body.min,
    maxReplicas: req.body.max,
  };
});
```

A caller sends `cpuRequest` instead of `cpu`. The workload has `cpuRequest: undefined`. The cost optimizer can't place it. It stays unassigned forever.

## The Fix: TypeScript

```ts
// src/types/index.ts
export interface Workload {
  id: string;
  cpuRequest: number;
  memoryRequest: number;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
}

export interface ScalingRule {
  workloadId: string;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpStep: number;
  scaleDownStep: number;
  cooldownMs: number;
}

export interface ScalingDecision {
  workloadId: string;
  action: 'scale_up' | 'scale_down' | 'none';
  targetReplicas: number;
  reason: string;
  timestamp: number;
}

export interface MetricPoint {
  workloadId: string;
  type: 'cpu' | 'memory' | 'requests_per_second';
  value: number;
  timestamp: number;
}

export interface Node {
  id: string;
  cpuCapacity: number;
  memoryCapacity: number;
  cpuAllocated: number;
  memoryAllocated: number;
  workloads: string[];
}

export interface AllocationPlan {
  assignments: Map<string, string[]>;
  unassigned: string[];
  estimatedCost: number;
}
```

```ts
// src/services/metricsService.ts
import { MetricPoint } from '../types/index.js';

const metrics: MetricPoint[] = [];

export function addMetric(point: MetricPoint): void {
  metrics.push(point);
}

export function getAverageMetric(
  workloadId: string,
  metricType: MetricPoint['type'],
  windowMs: number
): number | undefined {
  const cutoff = Date.now() - windowMs;
  const values = metrics
    .filter(
      m =>
        m.workloadId === workloadId &&
        m.type === metricType &&
        m.timestamp >= cutoff
    )
    .map(m => m.value);

  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
```

## What Changed

1. **Metric safety** — `value` is `number`. String concatenation is impossible.
2. **Decision completeness** — `targetReplicas` is required. No undefined scaling targets.
3. **Workload integrity** — `cpuRequest` and `memoryRequest` are numbers. No silent undefined.
4. **Cost optimization** — `AllocationPlan` has a fixed shape. Controllers can't miss fields.

## Trade-Offs

- **Numeric precision** — floating-point averages can have rounding issues
- **Time handling** — `timestamp` is `number` (ms since epoch). Date objects are avoided for simplicity.
- **Map serialization** — `AllocationPlan.assignments` is a `Map`. JSON serialization requires conversion.

## Migration Path

```bash
# 1. Define platform types
mkdir src/types
# Workload, ScalingRule, ScalingDecision, MetricPoint, Node, AllocationPlan

# 2. Type metrics first (data foundation)
# metricsService.ts → scalingService.ts → costOptimizer.ts

# 3. Add strict checks
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## Result

Wrong scaling decisions from string metrics drop to zero. Every scaling decision has a valid target. Cost optimization plans are always complete. The platform makes mathematically sound decisions.
