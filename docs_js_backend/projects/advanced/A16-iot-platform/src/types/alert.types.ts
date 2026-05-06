export interface AlertRule {
  id: string;
  name: string;
  deviceId?: string;
  deviceType?: string;
  condition: AlertCondition;
  actions: AlertAction[];
  enabled: boolean;
  createdAt: Date;
}

export interface AlertCondition {
  measurement: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  threshold: number;
  duration?: number; // seconds (must violate for this long)
}

export interface AlertAction {
  type: 'webhook' | 'email' | 'sms' | 'mqtt';
  target: string;
  payload?: Record<string, unknown>;
}

export interface AlertEvent {
  id: string;
  ruleId: string;
  deviceId: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  triggeredAt: Date;
  resolvedAt?: Date;
}
