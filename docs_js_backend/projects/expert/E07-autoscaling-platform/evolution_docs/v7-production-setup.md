# v7 — Production Setup

Your autoscaling platform works locally. But production autoscaling controls real infrastructure. A wrong decision costs money or causes outages. You need safety limits, cost awareness, and operational safeguards.

## Pain #1: Runaway Scaling Costs

```typescript
// services/scalingService.ts
if (avgCpu > threshold) {
  const target = workload.currentReplicas + rule.scaleUpStep;
  return { action: 'scale_up', targetReplicas: target };
}
// No max spend limit. A bug scales to 10,000 nodes.
// The monthly cloud bill is $2M instead of $20K.
// The CFO calls an emergency meeting.
```

A metric reporting bug sends CPU=100% for all workloads. The scaler adds nodes continuously. By the time someone notices, 10,000 nodes are running. The cloud bill is catastrophic.

## Pain #2: Scaling During Maintenance Windows

```typescript
// services/scalingService.ts
const decision = evaluateScaling(workload, rule);
// No maintenance window awareness.
// At 2 AM, the platform scales up for a traffic spike.
// But the ops team is doing database maintenance.
// The new nodes can't connect to the DB. They crash loop.
```

The ops team schedules a database upgrade. The autoscaling platform, unaware, scales up workloads. New nodes can't reach the database. They enter crash loops. The cluster is overwhelmed.

## Pain #3: No Cost Attribution

```typescript
// services/costOptimizer.ts
const estimatedCost = activeNodes * 100;
// $100 per node is a stub. Real costs vary by instance type, region, and spot pricing.
// Finance asks: "How much does the web-api workload cost?"
// You have no answer.
```

Finance wants to know which teams are driving cloud costs. The platform tracks node counts but not actual billing. Teams have no cost visibility. The biggest cost drivers are unknown.

## Pain #4: Alert Fatigue from Flapping

```typescript
// services/scalingService.ts
// Even with hysteresis, edge cases cause occasional flapping.
// PagerDuty fires 50 alerts per day.
// Engineers ignore scaling alerts.
// A real outage goes unnoticed for 30 minutes.
```

The hysteresis band is too narrow for one workload. It flaps 3 times per hour. Each flap triggers a PagerDuty alert. After a week, engineers mute the scaling alert channel. When a real scaling failure happens, no one sees it.

## The Fix: Production Autoscaling Platform

### Safety Limits and Budget Guards

```typescript
// src/services/safetyLimiter.ts
import { logger } from '../utils/logger.js';

const GLOBAL_MAX_NODES = 500;
const GLOBAL_MAX_SPEND_PER_HOUR = 5000; // $5000/hour
const WORKLOAD_MAX_REPLICAS = 100;

export function applySafetyLimits(
  decision: ScalingDecision,
  workload: Workload,
  globalState: GlobalState
): ScalingDecision {
  // Per-workload limit
  if (decision.targetReplicas > WORKLOAD_MAX_REPLICAS) {
    logger.warn({
      workloadId: workload.id,
      requested: decision.targetReplicas,
      limit: WORKLOAD_MAX_REPLICAS,
    }, 'Workload replica limit enforced');
    
    return {
      ...decision,
      targetReplicas: WORKLOAD_MAX_REPLICAS,
      reason: `${decision.reason} (capped at ${WORKLOAD_MAX_REPLICAS})`,
    };
  }
  
  // Global node limit
  const projectedNodes = globalState.currentNodes + (decision.targetReplicas - workload.currentReplicas);
  if (projectedNodes > GLOBAL_MAX_NODES) {
    logger.error({ projectedNodes, limit: GLOBAL_MAX_NODES }, 'Global node limit reached');
    
    return {
      workloadId: workload.id,
      action: 'none',
      targetReplicas: workload.currentReplicas,
      reason: 'Global node limit reached',
      timestamp: Date.now(),
    };
  }
  
  // Cost limit
  const projectedCost = globalState.currentHourlyCost + calculateIncrementalCost(decision, workload);
  if (projectedCost > GLOBAL_MAX_SPEND_PER_HOUR) {
    logger.error({ projectedCost, limit: GLOBAL_MAX_SPEND_PER_HOUR }, 'Hourly spend limit reached');
    
    return {
      workloadId: workload.id,
      action: 'none',
      targetReplicas: workload.currentReplicas,
      reason: 'Hourly spend limit reached',
      timestamp: Date.now(),
    };
  }
  
  return decision;
}
```

### Maintenance Window Awareness

```typescript
// src/services/maintenanceWindows.ts
interface MaintenanceWindow {
  id: string;
  startTime: Date;
  endTime: Date;
  affectedWorkloads: string[];
  scalingAction: 'freeze' | 'allow_scale_down_only' | 'normal';
}

export function isMaintenanceActive(
  workloadId: string,
  windows: MaintenanceWindow[]
): MaintenanceWindow | null {
  const now = new Date();
  return windows.find(w =>
    w.affectedWorkloads.includes(workloadId) &&
    w.startTime <= now &&
    w.endTime >= now
  ) || null;
}

export function applyMaintenancePolicy(
  decision: ScalingDecision,
  workload: Workload,
  windows: MaintenanceWindow[]
): ScalingDecision {
  const activeWindow = isMaintenanceActive(workload.id, windows);
  if (!activeWindow) return decision;
  
  switch (activeWindow.scalingAction) {
    case 'freeze':
      logger.info({ workloadId: workload.id, windowId: activeWindow.id }, 'Scaling frozen during maintenance');
      return {
        workloadId: workload.id,
        action: 'none',
        targetReplicas: workload.currentReplicas,
        reason: `Maintenance window active: ${activeWindow.id}`,
        timestamp: Date.now(),
      };
      
    case 'allow_scale_down_only':
      if (decision.action === 'scale_up') {
        logger.info({ workloadId: workload.id }, 'Scale up blocked during maintenance');
        return {
          workloadId: workload.id,
          action: 'none',
          targetReplicas: workload.currentReplicas,
          reason: 'Scale up blocked during maintenance',
          timestamp: Date.now(),
        };
      }
      return decision;
      
    default:
      return decision;
  }
}
```

### Real Cost Attribution

```typescript
// src/services/costTracker.ts
import { Pool } from 'pg';

const costDb = new Pool({ connectionString: process.env.COST_DATABASE_URL });

interface CostRate {
  instanceType: string;
  region: string;
  hourlyRate: number;
  spotDiscount: number;
}

export async function recordScalingCost(
  decision: ScalingDecision,
  workload: Workload,
  nodeType: string,
  region: string
): Promise<void> {
  const rate = await getCostRate(nodeType, region);
  const hourlyCost = (decision.targetReplicas - workload.currentReplicas) * rate.hourlyRate;
  
  await costDb.query(
    `INSERT INTO scaling_costs (
      workload_id, decision_timestamp, action,
      previous_replicas, target_replicas,
      instance_type, region, hourly_cost_delta
    ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)`,
    [
      workload.id,
      decision.action,
      workload.currentReplicas,
      decision.targetReplicas,
      nodeType,
      region,
      hourlyCost,
    ]
  );
  
  logger.info({
    workloadId: workload.id,
    action: decision.action,
    hourlyCostDelta: hourlyCost,
  }, 'Scaling cost recorded');
}

export async function getWorkloadCostReport(
  workloadId: string,
  startDate: Date,
  endDate: Date
): Promise<CostReport> {
  const result = await costDb.query(
    `SELECT
      action,
      COUNT(*) as action_count,
      SUM(hourly_cost_delta) as total_cost_delta
    FROM scaling_costs
    WHERE workload_id = $1 AND decision_timestamp BETWEEN $2 AND $3
    GROUP BY action`,
    [workloadId, startDate, endDate]
  );
  
  return {
    workloadId,
    period: { start: startDate, end: endDate },
    actions: result.rows,
  };
}
```

### Smart Alerting with Flap Detection

```typescript
// src/services/alertManager.ts
import { logger } from '../utils/logger.js';

interface AlertRule {
  name: string;
  condition: () => boolean;
  minDurationMs: number;
  cooldownMs: number;
  severity: 'warning' | 'critical';
}

class AlertManager {
  private alertStates = new Map<string, { firstTriggered: number; lastAlerted: number }>();
  
  evaluate(rule: AlertRule): void {
    const now = Date.now();
    const state = this.alertStates.get(rule.name);
    
    if (rule.condition()) {
      if (!state) {
        // First time triggered
        this.alertStates.set(rule.name, { firstTriggered: now, lastAlerted: 0 });
      } else if (now - state.firstTriggered >= rule.minDurationMs) {
        // Condition sustained for min duration
        if (now - state.lastAlerted >= rule.cooldownMs) {
          this.fireAlert(rule);
          state.lastAlerted = now;
        }
      }
    } else {
      // Condition cleared
      if (state) {
        logger.info({ rule: rule.name, duration: now - state.firstTriggered }, 'Alert condition cleared');
        this.alertStates.delete(rule.name);
      }
    }
  }
  
  private fireAlert(rule: AlertRule): void {
    logger.error({ rule: rule.name, severity: rule.severity }, 'ALERT');
    // Send to PagerDuty, Slack, etc.
  }
}

// Usage: Alert only if flapping persists for 10 minutes
const flappingAlert: AlertRule = {
  name: 'scaling_flapping',
  condition: () => getFlapRate('web-api') > 6, // More than 6 flaps/hour
  minDurationMs: 10 * 60 * 1000,
  cooldownMs: 60 * 60 * 1000, // Alert once per hour
  severity: 'warning',
};
```

## What Changed

1. **Cost safety** — Global node and spend limits prevent runaway scaling.
2. **Maintenance awareness** — Scaling respects ops windows.
3. **Cost attribution** — Every scaling decision records actual cloud costs.
4. **Smart alerting** — Sustained issues only. Flapping doesn't spam.

## Production Checklist

- [ ] Global max nodes limit
- [ ] Hourly spend limit with real pricing
- [ ] Per-workload max replicas
- [ ] Maintenance window scaling policies
- [ ] Cost attribution database
- [ ] Flap detection with sustained alerting
- [ ] Graceful shutdown with metric draining
- [ ] Deep health checks (metrics pipeline, scaling actuator)
- [ ] Predictive scaling with forecast validation
- [ ] Spot instance fallback for cost optimization
- [ ] Multi-region scaling awareness
- [ ] Budget overrun auto-rollback

## The Evolution

| Stage | State |
|-------|-------|
| v1 | Manual scale up/down script |
| v2 | TypeScript types for metrics and decisions |
| v3 | Validation for thresholds and workloads |
| v4 | Structured logging for decision transparency |
| v5 | Tests for scaling, hysteresis, and cost optimization |
| v6 | ESM for time-series and math libraries |
| v7 | Production autoscaling with safety limits, cost tracking, and operational awareness |

This is a production autoscaling platform. It handles metrics collection, threshold-based scaling, predictive forecasting, cost optimization, and operational safety. It started as a manual scaling script. Now it's a Kubernetes-scale controller.
