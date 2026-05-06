import type { ScalingDecision, ScalingRule, Workload } from '../types/index.js';
import { getAverageMetric } from './metricsService.js';
import { isCooldownElapsed, recordScaling } from './cooldownManager.js';
import { logger } from '../utils/logger.js';

export function evaluateWithHysteresis(workload: Workload, rule: ScalingRule): ScalingDecision {
  const avgCpu = getAverageMetric(workload.id, 'cpu', 30000);
  const timestamp = Date.now();

  if (avgCpu === undefined) {
    return { workloadId: workload.id, action: 'none', targetReplicas: workload.currentReplicas, reason: 'No metrics available', timestamp };
  }

  if (!isCooldownElapsed(workload.id, rule.cooldownMs)) {
    return { workloadId: workload.id, action: 'none', targetReplicas: workload.currentReplicas, reason: 'Cooldown active', timestamp };
  }

  const upThreshold = rule.scaleUpThreshold ?? 70;
  const downThreshold = rule.scaleDownThreshold ?? 30;

  if (avgCpu > upThreshold) {
    const target = Math.min(workload.currentReplicas + rule.scaleUpStep, workload.maxReplicas);
    if (target !== workload.currentReplicas) {
      recordScaling(workload.id, 'scale_up');
      logger.info('Scale up decision (hysteresis)', { workloadId: workload.id, avgCpu, upThreshold, target });
      return { workloadId: workload.id, action: 'scale_up', targetReplicas: target, reason: `CPU ${avgCpu.toFixed(1)}% > up threshold ${upThreshold}%`, timestamp };
    }
  } else if (avgCpu < downThreshold) {
    const target = Math.max(workload.currentReplicas - rule.scaleDownStep, workload.minReplicas);
    if (target !== workload.currentReplicas) {
      recordScaling(workload.id, 'scale_down');
      logger.info('Scale down decision (hysteresis)', { workloadId: workload.id, avgCpu, downThreshold, target });
      return { workloadId: workload.id, action: 'scale_down', targetReplicas: target, reason: `CPU ${avgCpu.toFixed(1)}% < down threshold ${downThreshold}%`, timestamp };
    }
  }

  return { workloadId: workload.id, action: 'none', targetReplicas: workload.currentReplicas, reason: 'Within deadband', timestamp };
}
