import { AlertRule, AlertCondition, TelemetryPoint, AlertEvent } from '../types/alert.types.js';
import { logger } from './logger.js';

export class RuleEngine {
  evaluate(rule: AlertRule, point: TelemetryPoint): AlertEvent | null {
    if (!rule.enabled) return null;

    const value = point.measurements[rule.condition.measurement];
    if (value === undefined) return null;

    const triggered = this.checkCondition(rule.condition, value);
    if (!triggered) return null;

    return {
      id: crypto.randomUUID(),
      ruleId: rule.id,
      deviceId: point.deviceId,
      message: `${rule.condition.measurement} ${rule.condition.operator} ${rule.condition.threshold} (value: ${value})`,
      severity: 'warning',
      triggeredAt: new Date(),
    };
  }

  private checkCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.threshold;
      case 'lt': return value < condition.threshold;
      case 'eq': return value === condition.threshold;
      case 'ne': return value !== condition.threshold;
      case 'gte': return value >= condition.threshold;
      case 'lte': return value <= condition.threshold;
      default:
        logger.warn({ operator: condition.operator }, 'Unknown operator');
        return false;
    }
  }
}

export const ruleEngine = new RuleEngine();
