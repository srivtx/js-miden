import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateScaling } from '../../src/services/scalingService.js';
import { ingestMetric, clearMetrics } from '../../src/services/metricsService.js';
import { clearState } from '../../src/services/cooldownManager.js';
import type { ScalingRule, Workload } from '../../src/types/index.js';

beforeEach(() => {
  clearMetrics();
  clearState();
});

const workload: Workload = {
  id: 'wl-1',
  currentReplicas: 2,
  minReplicas: 1,
  maxReplicas: 10,
  cpuRequest: 100,
  memoryRequest: 128,
};

const rule: ScalingRule = {
  workloadId: 'wl-1',
  threshold: 50,
  scaleUpStep: 1,
  scaleDownStep: 1,
  cooldownMs: 0,
};

function feedCpu(value: number) {
  ingestMetric({ workloadId: 'wl-1', name: 'cpu', value, timestamp: Date.now() });
}

describe('scalingService (buggy)', () => {
  it('scales up when CPU > threshold', () => {
    feedCpu(70);
    const decision = evaluateScaling(workload, rule);
    expect(decision.action).toBe('scale_up');
    expect(decision.targetReplicas).toBe(3);
  });

  it('scales down when CPU < threshold', () => {
    feedCpu(30);
    const decision = evaluateScaling(workload, rule);
    expect(decision.action).toBe('scale_down');
    expect(decision.targetReplicas).toBe(1);
  });
});
