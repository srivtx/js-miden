import { AlertRule, AlertEvent } from '../types/alert.types.js';
import { logger } from '../utils/logger.js';
import { ruleEngine } from '../utils/rule-engine.js';

const rules = new Map<string, AlertRule>();
const events = new Map<string, AlertEvent[]>();

export class AlertService {
  async createRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): Promise<AlertRule> {
    const newRule: AlertRule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    rules.set(newRule.id, newRule);
    logger.info({ ruleId: newRule.id }, 'Alert rule created');
    return newRule;
  }

  async getRule(id: string): Promise<AlertRule | null> {
    return rules.get(id) || null;
  }

  async listRules(): Promise<AlertRule[]> {
    return Array.from(rules.values());
  }

  async evaluateRules(deviceId: string, measurements: Record<string, number>): Promise<AlertEvent[]> {
    const triggered: AlertEvent[] = [];
    const deviceRules = Array.from(rules.values()).filter((r) => r.deviceId === deviceId || !r.deviceId);

    for (const rule of deviceRules) {
      const event = ruleEngine.evaluate(rule, {
        deviceId,
        timestamp: new Date(),
        measurements,
      });

      if (event) {
        triggered.push(event);
        const deviceEvents = events.get(deviceId) || [];
        deviceEvents.push(event);
        events.set(deviceId, deviceEvents);
        logger.warn({ event }, 'Alert triggered');
      }
    }

    return triggered;
  }

  async getEvents(deviceId: string): Promise<AlertEvent[]> {
    return events.get(deviceId) || [];
  }
}

export const alertService = new AlertService();
