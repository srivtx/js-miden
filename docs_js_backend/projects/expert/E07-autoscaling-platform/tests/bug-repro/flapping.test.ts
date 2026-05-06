import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateScaling } from '../../src/services/scalingService.js';
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

const buggyRule: ScalingRule = {
  workloadId: 'wl-1',
  threshold: 50,
  scaleUpStep: 1,
  scaleDownStep: 1,
  cooldownMs: 0,
};

const fixedRule: ScalingRule = {
  workloadId: 'wl-1',
  scaleUpThreshold: 60,
  scaleDownThreshold: 40,
  scaleUpStep: 1,
  scaleDownStep: 1,
  cooldownMs: 0,
};

function feedCpu(value: number) {
  ingestMetric({ workloadId: 'wl-1', name: 'cpu', value, timestamp: Date.now() });
}

describe('Flapping Bug Reproduction', () => {
  it('oscillates with single threshold around 50%', () => {
    const decisions: string[] = [];
    const wl: Workload = { ...workload };
    for (let i = 0; i < 10; i++) {
      // Drive average above threshold, then below it
      feedCpu(i < 3 ? 100 : 0);
      const d = evaluateScaling(wl, buggyRule);
      decisions.push(d.action);
      if (d.action !== 'none') {
        wl.currentReplicas = d.targetReplicas;
      }
    }
    const scaleUps = decisions.filter(a => a === 'scale_up').length;
    const scaleDowns = decisions.filter(a => a === 'scale_down').length;
    expect(scaleUps).toBeGreaterThan(0);
    expect(scaleDowns).toBeGreaterThan(0);
    // The bug causes alternation
    expect(scaleUps + scaleDowns).toBeGreaterThan(1);
  });

  it('does NOT oscillate with hysteresis deadband', () => {
    const decisions: string[] = [];
    const wl: Workload = { ...workload, currentReplicas: 2 };
    for (let i = 0; i < 10; i++) {
      feedCpu(i % 2 === 0 ? 51 : 49);
      const d = evaluateWithHysteresis(wl, fixedRule);
      decisions.push(d.action);
      if (d.action !== 'none') {
        wl.currentReplicas = d.targetReplicas;
      }
    }
    const scaleUps = decisions.filter(a => a === 'scale_up').length;
    const scaleDowns = decisions.filter(a => a === 'scale_down').length;
    // With 40-60 deadband, 49/51 are inside deadband -> no scaling
    expect(scaleUps).toBe(0);
    expect(scaleDowns).toBe(0);
  });
});
