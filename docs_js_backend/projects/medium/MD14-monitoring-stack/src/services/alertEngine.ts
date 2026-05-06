import type { AlertRule, AlertState } from '../types.js';
import { queryTimeSeries } from './metricStore.js';

const rules: AlertRule[] = [];
const alertStates = new Map<string, AlertState>();

export function createRule(rule: AlertRule): void {
  rules.push(rule);
}

export function getRules(): AlertRule[] {
  return [...rules];
}

export function getAlertStates(): AlertState[] {
  return Array.from(alertStates.values());
}

export function evaluateRules(): void {
  for (const rule of rules) {
    const series = queryTimeSeries(rule.metricName, rule.labels);
    const latest = series
      .flatMap((s) => s.values)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    const currentValue = latest?.value ?? 0;
    let triggered = false;

    if (rule.condition === 'gt') triggered = currentValue > rule.threshold;
    if (rule.condition === 'lt') triggered = currentValue < rule.threshold;
    if (rule.condition === 'eq') triggered = currentValue === rule.threshold;

    const state = alertStates.get(rule.id);

    // BUG: Alert flapping — no hysteresis or duration check.
    // The alert toggles on/off immediately every time the threshold is crossed.
    // A real system would require the condition to hold for `durationMs`.
    if (triggered) {
      alertStates.set(rule.id, {
        ruleId: rule.id,
        active: true,
        triggeredAt: Date.now(),
        currentValue,
      });
    } else {
      if (state) {
        alertStates.set(rule.id, {
          ...state,
          active: false,
          resolvedAt: Date.now(),
          currentValue,
        });
      }
    }
  }
}

export function clearRules(): void {
  rules.length = 0;
  alertStates.clear();
}
