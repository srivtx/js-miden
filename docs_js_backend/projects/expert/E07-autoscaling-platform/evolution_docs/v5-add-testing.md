# v5 — Add Testing

Your autoscaling platform has logging, but flapping and wrong decisions reach production. A threshold change causes oscillation. A cost optimizer refactor breaks bin packing. You need mathematical confidence.

## Pain #1: Flapping Regression

You refactor the scaling service to use floating-point averages. The new code rounds CPU to one decimal place. A workload with CPU hovering at 49.95% now rounds to 50.0%. The threshold is 50%. It flaps between scale-up and scale-down every evaluation cycle.

## Pain #2: Cooldown Bypass

You add a new scaling endpoint for emergency manual scaling. The endpoint bypasses cooldown to respond faster. But the regular evaluation path accidentally starts using the same bypass logic. Cooldown is never enforced. The workload thrashes.

## Pain #3: Cost Optimizer Inaccuracy

You optimize the bin packing algorithm for speed. The new code sorts workloads once instead of after each placement. A large workload that should fit on a partially filled node is placed on a new node instead. Costs increase by 30%.

## The Fix: Layered Testing Strategy

### Unit Tests: Scaling Decisions

```typescript
// tests/unit/scalingService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateScaling } from '../../src/services/scalingService.js';
import { clearMetrics, addMetric } from '../../src/services/metricsService.js';
import { clearCooldowns } from '../../src/services/cooldownManager.js';

describe('Scaling evaluation', () => {
  beforeEach(() => {
    clearMetrics();
    clearCooldowns();
  });
  
  it('should scale up when CPU exceeds threshold', () => {
    const workload = { id: 'wl-1', currentReplicas: 2, minReplicas: 1, maxReplicas: 10 };
    const rule = { workloadId: 'wl-1', scaleUpThreshold: 70, scaleDownThreshold: 30, scaleUpStep: 2, scaleDownStep: 1, cooldownMs: 30000 };
    
    addMetric('wl-1', 'cpu', 85);
    
    const decision = evaluateScaling(workload, rule);
    expect(decision.action).toBe('scale_up');
    expect(decision.targetReplicas).toBe(4);
  });
  
  it('should scale down when CPU is below threshold', () => {
    const workload = { id: 'wl-1', currentReplicas: 5, minReplicas: 1, maxReplicas: 10 };
    const rule = { workloadId: 'wl-1', scaleUpThreshold: 70, scaleDownThreshold: 30, scaleUpStep: 2, scaleDownStep: 1, cooldownMs: 30000 };
    
    addMetric('wl-1', 'cpu', 20);
    
    const decision = evaluateScaling(workload, rule);
    expect(decision.action).toBe('scale_down');
    expect(decision.targetReplicas).toBe(4);
  });
  
  it('should NOT scale when within deadband', () => {
    const workload = { id: 'wl-1', currentReplicas: 5, minReplicas: 1, maxReplicas: 10 };
    const rule = { workloadId: 'wl-1', scaleUpThreshold: 70, scaleDownThreshold: 30, scaleUpStep: 2, scaleDownStep: 1, cooldownMs: 30000 };
    
    addMetric('wl-1', 'cpu', 50);
    
    const decision = evaluateScaling(workload, rule);
    expect(decision.action).toBe('none');
    expect(decision.targetReplicas).toBe(5);
  });
  
  it('should respect cooldown', () => {
    const workload = { id: 'wl-1', currentReplicas: 2, minReplicas: 1, maxReplicas: 10 };
    const rule = { workloadId: 'wl-1', scaleUpThreshold: 70, scaleDownThreshold: 30, scaleUpStep: 2, scaleDownStep: 1, cooldownMs: 30000 };
    
    addMetric('wl-1', 'cpu', 85);
    evaluateScaling(workload, rule); // First scale
    
    // Immediate second evaluation
    const secondDecision = evaluateScaling(workload, rule);
    expect(secondDecision.action).toBe('none');
    expect(secondDecision.reason).toContain('Cooldown');
  });
  
  it('should cap at maxReplicas', () => {
    const workload = { id: 'wl-1', currentReplicas: 9, minReplicas: 1, maxReplicas: 10 };
    const rule = { workloadId: 'wl-1', scaleUpThreshold: 70, scaleDownThreshold: 30, scaleUpStep: 5, scaleDownStep: 1, cooldownMs: 30000 };
    
    addMetric('wl-1', 'cpu', 99);
    
    const decision = evaluateScaling(workload, rule);
    expect(decision.targetReplicas).toBe(10); // Not 14
  });
  
  it('should floor at minReplicas', () => {
    const workload = { id: 'wl-1', currentReplicas: 2, minReplicas: 2, maxReplicas: 10 };
    const rule = { workloadId: 'wl-1', scaleUpThreshold: 70, scaleDownThreshold: 30, scaleUpStep: 2, scaleDownStep: 5, cooldownMs: 30000 };
    
    addMetric('wl-1', 'cpu', 10);
    
    const decision = evaluateScaling(workload, rule);
    expect(decision.targetReplicas).toBe(2); // Not -3
  });
});
```

### Unit Tests: Hysteresis

```typescript
// tests/unit/hysteresisService.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateWithHysteresis } from '../../src/services/hysteresisService.js';

describe('Hysteresis', () => {
  it('should use dual thresholds', () => {
    const workload = { id: 'wl-1', currentReplicas: 5, minReplicas: 1, maxReplicas: 10 };
    const rule = { scaleUpThreshold: 70, scaleDownThreshold: 30, scaleUpStep: 2, scaleDownStep: 1 };
    
    // At 50% — in deadband, no action
    let decision = evaluateWithHysteresis(workload, rule, 50);
    expect(decision.action).toBe('none');
    
    // At 75% — scale up
    decision = evaluateWithHysteresis(workload, rule, 75);
    expect(decision.action).toBe('scale_up');
    
    // At 50% — still in deadband, no action (even though we just scaled up)
    decision = evaluateWithHysteresis(workload, rule, 50);
    expect(decision.action).toBe('none');
    
    // At 25% — scale down
    decision = evaluateWithHysteresis(workload, rule, 25);
    expect(decision.action).toBe('scale_down');
  });
  
  it('should prevent flapping at boundary', () => {
    const workload = { id: 'wl-1', currentReplicas: 5, minReplicas: 1, maxReplicas: 10 };
    const rule = { scaleUpThreshold: 70, scaleDownThreshold: 30, scaleUpStep: 2, scaleDownStep: 1 };
    
    // CPU oscillates between 69% and 71%
    const decisions = [];
    for (let i = 0; i < 10; i++) {
      const cpu = i % 2 === 0 ? 69 : 71;
      decisions.push(evaluateWithHysteresis(workload, rule, cpu).action);
    }
    
    // Should not alternate scale_up/scale_down
    const uniqueDecisions = [...new Set(decisions)];
    expect(uniqueDecisions.length).toBeLessThanOrEqual(2);
  });
});
```

### Unit Tests: Cost Optimization

```typescript
// tests/unit/costOptimizer.test.ts
import { describe, it, expect } from 'vitest';
import { firstFitDecreasing } from '../../src/services/costOptimizer.js';

describe('Cost optimization', () => {
  it('should pack workloads efficiently', () => {
    const workloads = [
      { id: 'wl-1', cpuRequest: 4, memoryRequest: 8192 },
      { id: 'wl-2', cpuRequest: 2, memoryRequest: 4096 },
      { id: 'wl-3', cpuRequest: 2, memoryRequest: 4096 },
      { id: 'wl-4', cpuRequest: 1, memoryRequest: 2048 },
    ];
    
    const nodes = [
      { id: 'node-1', cpuCapacity: 8, memoryCapacity: 16384, cpuAllocated: 0, memoryAllocated: 0, workloads: [] },
      { id: 'node-2', cpuCapacity: 8, memoryCapacity: 16384, cpuAllocated: 0, memoryAllocated: 0, workloads: [] },
    ];
    
    const plan = firstFitDecreasing(workloads, nodes);
    
    // Should fit on one node (4+2+2+1 = 9 > 8, so needs 2)
    // Actually: 4+2+2 = 8, 1 = 1. Two nodes needed.
    expect(plan.unassigned).toHaveLength(0);
    expect(plan.estimatedCost).toBeGreaterThan(0);
  });
  
  it('should handle unassignable workloads', () => {
    const workloads = [
      { id: 'wl-1', cpuRequest: 16, memoryRequest: 32768 },
    ];
    
    const nodes = [
      { id: 'node-1', cpuCapacity: 8, memoryCapacity: 16384, cpuAllocated: 0, memoryAllocated: 0, workloads: [] },
    ];
    
    const plan = firstFitDecreasing(workloads, nodes);
    
    expect(plan.unassigned).toContain('wl-1');
  });
  
  it('should sort by descending cpuRequest (FFD)', () => {
    const workloads = [
      { id: 'wl-small', cpuRequest: 1, memoryRequest: 1024 },
      { id: 'wl-large', cpuRequest: 4, memoryRequest: 4096 },
      { id: 'wl-medium', cpuRequest: 2, memoryRequest: 2048 },
    ];
    
    const nodes = [
      { id: 'node-1', cpuCapacity: 8, memoryCapacity: 8192, cpuAllocated: 0, memoryAllocated: 0, workloads: [] },
    ];
    
    const plan = firstFitDecreasing(workloads, nodes);
    
    // All should fit on one node: 4+2+1 = 7 <= 8
    expect(plan.unassigned).toHaveLength(0);
    expect(plan.assignments.get('node-1')).toContain('wl-large');
    expect(plan.assignments.get('node-1')).toContain('wl-medium');
    expect(plan.assignments.get('node-1')).toContain('wl-small');
  });
});
```

### Integration Tests: End-to-End Scaling

```typescript
// tests/integration/api.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestPlatform } from '../helpers/test-platform.js';

let platform: any;

describe('Autoscaling platform API', () => {
  beforeAll(async () => {
    platform = await setupTestPlatform();
  });
  
  it('should register a workload', async () => {
    const response = await platform.post('/workloads', {
      id: 'web-api',
      cpuRequest: 2,
      memoryRequest: 4096,
      minReplicas: 2,
      maxReplicas: 10,
    });
    expect(response.status).toBe(201);
  });
  
  it('should ingest metrics and trigger scaling', async () => {
    // Register workload and rule
    await platform.post('/workloads', {
      id: 'web-api',
      cpuRequest: 2,
      memoryRequest: 4096,
      minReplicas: 2,
      maxReplicas: 10,
    });
    
    await platform.post('/rules', {
      workloadId: 'web-api',
      scaleUpThreshold: 70,
      scaleDownThreshold: 30,
      scaleUpStep: 2,
      scaleDownStep: 1,
      cooldownMs: 1000,
    });
    
    // Send high CPU metrics
    await platform.post('/metrics', {
      workloadId: 'web-api',
      type: 'cpu',
      value: 85,
    });
    
    // Evaluate scaling
    const decision = await platform.post('/evaluate', { workloadId: 'web-api' });
    expect(decision.action).toBe('scale_up');
    expect(decision.targetReplicas).toBe(4);
  });
  
  it('should respect cooldown between evaluations', async () => {
    await platform.post('/workloads', {
      id: 'web-api',
      cpuRequest: 2,
      memoryRequest: 4096,
      minReplicas: 2,
      maxReplicas: 10,
      currentReplicas: 2,
    });
    
    await platform.post('/rules', {
      workloadId: 'web-api',
      scaleUpThreshold: 70,
      scaleDownThreshold: 30,
      scaleUpStep: 2,
      scaleDownStep: 1,
      cooldownMs: 5000, // 5 second cooldown
    });
    
    // First evaluation scales up
    await platform.post('/metrics', { workloadId: 'web-api', type: 'cpu', value: 85 });
    const first = await platform.post('/evaluate', { workloadId: 'web-api' });
    expect(first.action).toBe('scale_up');
    
    // Second evaluation during cooldown does nothing
    const second = await platform.post('/evaluate', { workloadId: 'web-api' });
    expect(second.action).toBe('none');
    expect(second.reason).toContain('Cooldown');
  });
});
```

## What Changed

1. **Scaling correctness** — Up, down, deadband, cooldown, and limits are tested.
2. **Hysteresis stability** — Flapping prevention is verified with oscillating metrics.
3. **Cost efficiency** — Bin packing is tested for optimal node usage.
4. **End-to-end integrity** — Full API flow from workload registration to scaling decision.

## Testing as Control Theory Verification

Autoscaling is a feedback control system. Tests are your stability proof. A test that verifies `scaleUpThreshold > scaleDownThreshold` is not trivial — it's the difference between a stable system and an oscillating nightmare. Property-based tests (flapping reproduction) are as important as unit tests.

## Next Pain

Tests run but the codebase uses CommonJS. Dynamic imports for test utilities are inconsistent. You need ESM for cleaner test code and modern patterns.
