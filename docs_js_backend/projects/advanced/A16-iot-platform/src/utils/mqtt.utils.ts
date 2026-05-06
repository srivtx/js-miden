import { logger } from './logger.js';

export interface MqttTopic {
  deviceId: string;
  action: 'telemetry' | 'command' | 'status' | 'ota';
  subtopic?: string;
}

export function parseTopic(topic: string): MqttTopic | null {
  // Topic format: devices/{deviceId}/{action}/{subtopic?}
  const parts = topic.split('/');
  if (parts.length < 3 || parts[0] !== 'devices') {
    return null;
  }

  const deviceId = parts[1];
  const action = parts[2] as MqttTopic['action'];
  const subtopic = parts[3];

  if (!['telemetry', 'command', 'status', 'ota'].includes(action)) {
    return null;
  }

  return { deviceId, action, subtopic };
}

export function buildTopic(deviceId: string, action: MqttTopic['action'], subtopic?: string): string {
  const base = `devices/${deviceId}/${action}`;
  return subtopic ? `${base}/${subtopic}` : base;
}

/**
 * Validate MQTT payload format.
 * In production: use Protobuf, Avro, or JSON Schema.
 */
export function validatePayload(payload: Buffer): unknown {
  try {
    return JSON.parse(payload.toString());
  } catch {
    logger.warn('Invalid MQTT payload: not valid JSON');
    return null;
  }
}
