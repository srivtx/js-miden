import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateWithHysteresis } from '../../src/services/hysteresisService.js';
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
  scaleUpThreshold: 70,
  scaleDownThreshold: 30,
  scaleUpStep: 1,
  scaleDownStep: 1,
  cooldownMs: 0,
};

function feedCpu(value: number) {
  ingestMetric({ workloadId: 'wl-1', name: 'cpu', value, timestamp: Date.now() });
}

describe('hysteresisService', () => {
  it('does NOT scale down when CPU is 50 (inside deadband)', () => {
    feedCpu(50);
    const decision = evaluateWithHysteresis(workload, rule);
    expect(decision.action).toBe('none');
  });

  it('scales up when CPU > up threshold', () => {
    feedCpu(75);
    const decision = evaluateWithHysteresis(workload, rule);
    expect(decision.action).toBe('scale_up');
  });

  it('scales down when CPU < down threshold', () => {
    feedCpu(25);
    const decision = evaluateWithHysteresis(workload, rule);
    expect(decision.action).toBe('scale_down');
  });
});
