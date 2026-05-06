# v4 — Add Logging

Your autoscaling platform makes scaling decisions every 30 seconds. When it scales up at the wrong time or fails to scale during a traffic spike, you have no record of why the decision was made.

## Pain #1: Scaling Decisions Without Rationale

```typescript
// services/scalingService.ts (before)
function evaluateScaling(workload, rule) {
  const avgCpu = getAverageMetric(workload.id, 'cpu', 30000);
  console.log('CPU for', workload.id, ':', avgCpu);
  
  if (avgCpu > rule.threshold) {
    console.log('Scaling up');
    return { action: 'scale_up', targetReplicas: workload.currentReplicas + rule.scaleUpStep };
  }
  // ...
}
```

A workload scaled up at 2 AM when traffic was low. The log says `"Scaling up"` but not:
- The exact CPU value that triggered it
- The threshold that was compared
- Whether cooldown was active
- The current replica count before and after
- The timestamp of the last scaling action

## Pain #2: Metric Gaps Without Detection

```typescript
// services/metricsService.ts (before)
function addMetric(workloadId, metricType, value) {
  metrics.push({ workloadId, metricType, value, timestamp: Date.now() });
  console.log('Metric added:', workloadId, metricType, value);
}
```

A workload stops receiving metrics. The scaler sees `avgCpu === undefined` and does nothing. The log shows the last metric but not:
- How many metrics are in the window
- The window start and end times
- Whether the metric stream has stalled
- The fallback behavior when metrics are missing

## Pain #3: Cost Optimization Without Transparency

```typescript
// services/costOptimizer.ts (before)
function firstFitDecreasing(workloads, nodes) {
  console.log('Optimizing placement');
  // ...
  console.log('Active nodes:', activeNodes);
  return { assignments, unassigned, estimatedCost };
}
```

The monthly cloud bill is $50,000 higher than expected. The log shows placement happened but not:
- Which workloads were assigned to which nodes
- Why some workloads were unassigned
- The cost model parameters used
- Whether spot instances were considered

## The Fix: Structured Logging with Decision Context

```typescript
// src/utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'autoscaler',
    version: process.env.SERVICE_VERSION,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createScalingLogger(workloadId: string) {
  return logger.child({ workloadId, context: 'scaling' });
}

export function createMetricsLogger(workloadId: string) {
  return logger.child({ workloadId, context: 'metrics' });
}
```

```typescript
// src/services/scalingService.ts
import { logger, createScalingLogger } from '../utils/logger.js';

export function evaluateScaling(workload: Workload, rule: ScalingRule): ScalingDecision {
  const log = createScalingLogger(workload.id);
  const timestamp = Date.now();
  
  const avgCpu = getAverageMetric(workload.id, 'cpu', 30000);
  log.info({ avgCpu, windowMs: 30000, currentReplicas: workload.currentReplicas }, 'Evaluating scaling');
  
  if (avgCpu === undefined) {
    log.warn('No metrics available for scaling decision');
    return { workloadId: workload.id, action: 'none', targetReplicas: workload.currentReplicas, reason: 'No metrics available', timestamp };
  }
  
  if (!isCooldownElapsed(workload.id, rule.cooldownMs)) {
    const lastScale = getLastScaleTime(workload.id);
    log.info({ lastScale, cooldownMs: rule.cooldownMs, remainingMs: rule.cooldownMs - (timestamp - lastScale) }, 'Cooldown active');
    return { workloadId: workload.id, action: 'none', targetReplicas: workload.currentReplicas, reason: 'Cooldown active', timestamp };
  }
  
  if (avgCpu > rule.scaleUpThreshold) {
    const target = Math.min(workload.currentReplicas + rule.scaleUpStep, workload.maxReplicas);
    log.info({
      avgCpu,
      threshold: rule.scaleUpThreshold,
      currentReplicas: workload.currentReplicas,
      targetReplicas: target,
      scaleUpStep: rule.scaleUpStep,
      reason: `CPU ${avgCpu.toFixed(1)}% > ${rule.scaleUpThreshold}%`,
    }, 'Scale up decision');
    recordScaling(workload.id, 'scale_up');
    return { workloadId: workload.id, action: 'scale_up', targetReplicas: target, reason: `CPU ${avgCpu.toFixed(1)}% > ${rule.scaleUpThreshold}%`, timestamp };
  }
  
  if (avgCpu < rule.scaleDownThreshold) {
    const target = Math.max(workload.currentReplicas - rule.scaleDownStep, workload.minReplicas);
    log.info({
      avgCpu,
      threshold: rule.scaleDownThreshold,
      currentReplicas: workload.currentReplicas,
      targetReplicas: target,
      scaleDownStep: rule.scaleDownStep,
      reason: `CPU ${avgCpu.toFixed(1)}% < ${rule.scaleDownThreshold}%`,
    }, 'Scale down decision');
    recordScaling(workload.id, 'scale_down');
    return { workloadId: workload.id, action: 'scale_down', targetReplicas: target, reason: `CPU ${avgCpu.toFixed(1)}% < ${rule.scaleDownThreshold}%`, timestamp };
  }
  
  log.info({ avgCpu, upThreshold: rule.scaleUpThreshold, downThreshold: rule.scaleDownThreshold }, 'Within threshold, no action');
  return { workloadId: workload.id, action: 'none', targetReplicas: workload.currentReplicas, reason: 'Within threshold', timestamp };
}
```

```typescript
// src/services/costOptimizer.ts
import { logger } from '../utils/logger.js';

export function firstFitDecreasing(workloads: Workload[], nodes: Node[]): AllocationPlan {
  logger.info({ workloadCount: workloads.length, nodeCount: nodes.length }, 'Starting cost optimization');
  
  const sorted = [...workloads].sort((a, b) => b.cpuRequest - a.cpuRequest);
  const assignments = new Map<string, string[]>();
  const unassigned: string[] = [];
  
  for (const node of nodes) {
    assignments.set(node.id, [...node.workloads]);
  }
  
  for (const wl of sorted) {
    let placed = false;
    for (const node of nodes) {
      const remainingCpu = node.cpuCapacity - node.cpuAllocated;
      const remainingMem = node.memoryCapacity - node.memoryAllocated;
      
      if (wl.cpuRequest <= remainingCpu && wl.memoryRequest <= remainingMem) {
        node.cpuAllocated += wl.cpuRequest;
        node.memoryAllocated += wl.memoryRequest;
        node.workloads.push(wl.id);
        assignments.get(node.id)!.push(wl.id);
        placed = true;
        logger.debug({ workloadId: wl.id, nodeId: node.id, remainingCpu, remainingMem }, 'Workload placed');
        break;
      }
    }
    if (!placed) {
      unassigned.push(wl.id);
      logger.warn({ workloadId: wl.id, cpuRequest: wl.cpuRequest, memoryRequest: wl.memoryRequest }, 'Workload unassigned');
    }
  }
  
  const activeNodes = nodes.filter(n => n.workloads.length > 0).length;
  const estimatedCost = activeNodes * 100;
  
  logger.info({ activeNodes, unassignedCount: unassigned.length, estimatedCost }, 'Cost optimization completed');
  
  return { assignments, unassigned, estimatedCost };
}
```

## Log Output Example

```json
{
  "level": 30,
  "time": "2025-01-15T03:15:00.000Z",
  "service": "autoscaler",
  "version": "1.5.0",
  "workloadId": "web-api-prod",
  "context": "scaling",
  "avgCpu": 78.5,
  "threshold": 70,
  "currentReplicas": 5,
  "targetReplicas": 8,
  "scaleUpStep": 3,
  "reason": "CPU 78.5% > 70%",
  "msg": "Scale up decision"
}
```

## What Changed

1. **Decision transparency** — Every scaling decision logs the exact metric, threshold, and rationale.
2. **Cooldown visibility** — Active cooldowns log the remaining time.
3. **Placement audit** — Cost optimization logs every assignment and unassignment.
4. **Metric health** — Missing metrics trigger warnings, not silent inaction.

## Logging as Control Theory Debugging

Autoscaling is a feedback control system. When it oscillates or fails to respond, logs are the only way to determine whether the sensor (metrics), controller (scaling logic), or actuator (node provisioning) is at fault. Without structured logs, you're tuning blind.

## Next Pain

You fix the flapping bug by adding hysteresis. But you have no test that verifies the scaler doesn't flip between 5 and 8 replicas when CPU is 68%. You need automated testing.
