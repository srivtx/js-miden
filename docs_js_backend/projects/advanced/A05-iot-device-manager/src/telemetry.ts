import { storage } from './storage.js';

export interface TelemetryPayload {
  deviceId: string;
  temperature: number;
  humidity: number;
  timestamp?: number;
}

export interface TelemetryReading {
  id: string;
  deviceId: string;
  temperature: number;
  humidity: number;
  timestamp: number;
  receivedAt: number;
}

export async function recordTelemetry(payload: TelemetryPayload): Promise<TelemetryReading> {
  const reading: TelemetryReading = {
    id: `tel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    deviceId: payload.deviceId,
    temperature: payload.temperature,
    humidity: payload.humidity,
    timestamp: payload.timestamp || Date.now(),
    receivedAt: Date.now(),
  };
  await storage.saveTelemetry(reading);
  return reading;
}

export async function getTelemetry(deviceId: string, limit = 100): Promise<TelemetryReading[]> {
  return storage.getTelemetryForDevice(deviceId, limit);
}

export async function getLatestTelemetry(deviceId: string): Promise<TelemetryReading | null> {
  const readings = await storage.getTelemetryForDevice(deviceId, 1);
  return readings[0] || null;
}
