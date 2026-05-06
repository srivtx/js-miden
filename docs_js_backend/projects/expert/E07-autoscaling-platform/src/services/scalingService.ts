import type { ScalingDecision, ScalingRule, Workload } from '../types/index.js';
import { getAverageMetric } from './metricsService.js';
import { isCooldownElapsed, recordScaling } from './cooldownManager.js';
import { logger } from '../utils/logger.js';

export function evaluateScaling(workload: Workload, rule: ScalingRule): ScalingDecision {
  const avgCpu = getAverageMetric(workload.id, 'cpu', 30000);
  const timestamp = Date.now();

  if (avgCpu === undefined) {
    return { workloadId: workload.id, action: 'none', targetReplicas: workload.currentReplicas, reason: 'No metrics available', timestamp };
  }

  if (!isCooldownElapsed(workload.id, rule.cooldownMs)) {
    return { workloadId: workload.id, action: 'none', targetReplicas: workload.currentReplicas, reason: 'Cooldown active', timestamp };
  }

  // BUG: single threshold causes flapping
  const threshold = rule.threshold ?? 50;

  if (avgCpu > threshold) {
    const target = Math.min(workload.currentReplicas + rule.scaleUpStep, workload.maxReplicas);
    if (target !== workload.currentReplicas) {
      recordScaling(workload.id, 'scale_up');
      logger.info('Scale up decision', { workloadId: workload.id, avgCpu, threshold, target });
      return { workloadId: workload.id, action: 'scale_up', targetReplicas: target, reason: `CPU ${avgCpu.toFixed(1)}% > ${threshold}%`, timestamp };
    }
  } else if (avgCpu < threshold) {
    const target = Math.max(workload.currentReplicas - rule.scaleDownStep, workload.minReplicas);
    if (target !== workload.currentReplicas) {
      recordScaling(workload.id, 'scale_down');
      logger.info('Scale down decision', { workloadId: workload.id, avgCpu, threshold, target });
      return { workloadId: workload.id, action: 'scale_down', targetReplicas: target, reason: `CPU ${avgCpu.toFixed(1)}% < ${threshold}%`, timestamp };
    }
  }

  return { workloadId: workload.id, action: 'none', targetReplicas: workload.currentReplicas, reason: 'Within threshold', timestamp };
}
