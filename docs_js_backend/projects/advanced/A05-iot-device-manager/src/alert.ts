import { storage } from './storage.js';
import { TelemetryReading } from './telemetry.js';

export interface Alert {
  id: string;
  deviceId: string;
  type: 'temperature_high' | 'temperature_critical' | 'humidity_high' | 'humidity_low';
  message: string;
  threshold: number;
  actualValue: number;
  timestamp: number;
  acknowledged: boolean;
}

export const TEMPERATURE_THRESHOLD = 35; // degrees Celsius
export const TEMPERATURE_CRITICAL = 45;
export const HUMIDITY_HIGH_THRESHOLD = 80;
export const HUMIDITY_LOW_THRESHOLD = 20;

export async function checkAlerts(reading: TelemetryReading): Promise<Alert[]> {
  const alerts: Alert[] = [];

  if (reading.temperature > TEMPERATURE_CRITICAL) {
    alerts.push({
      id: `alt_${Date.now()}_crit`,
      deviceId: reading.deviceId,
      type: 'temperature_critical',
      message: `Critical temperature: ${reading.temperature}C exceeds ${TEMPERATURE_CRITICAL}C`,
      threshold: TEMPERATURE_CRITICAL,
      actualValue: reading.temperature,
      timestamp: Date.now(),
      acknowledged: false,
    });
  } else if (reading.temperature > TEMPERATURE_THRESHOLD) {
    alerts.push({
      id: `alt_${Date.now()}_high`,
      deviceId: reading.deviceId,
      type: 'temperature_high',
      message: `High temperature: ${reading.temperature}C exceeds ${TEMPERATURE_THRESHOLD}C`,
      threshold: TEMPERATURE_THRESHOLD,
      actualValue: reading.temperature,
      timestamp: Date.now(),
      acknowledged: false,
    });
  }

  if (reading.humidity > HUMIDITY_HIGH_THRESHOLD) {
    alerts.push({
      id: `alt_${Date.now()}_hum_high`,
      deviceId: reading.deviceId,
      type: 'humidity_high',
      message: `High humidity: ${reading.humidity}% exceeds ${HUMIDITY_HIGH_THRESHOLD}%`,
      threshold: HUMIDITY_HIGH_THRESHOLD,
      actualValue: reading.humidity,
      timestamp: Date.now(),
      acknowledged: false,
    });
  } else if (reading.humidity < HUMIDITY_LOW_THRESHOLD) {
    alerts.push({
      id: `alt_${Date.now()}_hum_low`,
      deviceId: reading.deviceId,
      type: 'humidity_low',
      message: `Low humidity: ${reading.humidity}% below ${HUMIDITY_LOW_THRESHOLD}%`,
      threshold: HUMIDITY_LOW_THRESHOLD,
      actualValue: reading.humidity,
      timestamp: Date.now(),
      acknowledged: false,
    });
  }

  for (const alert of alerts) {
    await storage.saveAlert(alert);
  }

  return alerts;
}

export async function getAlerts(deviceId: string): Promise<Alert[]> {
  return storage.getAlertsForDevice(deviceId);
}

export async function acknowledgeAlert(alertId: string): Promise<Alert | null> {
  return storage.updateAlert(alertId, { acknowledged: true });
}
