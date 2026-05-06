import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/storage.js';
import { registerDevice } from '../src/device.js';
import { recordTelemetry } from '../src/telemetry.js';
import { checkAlerts, getAlerts, acknowledgeAlert, TEMPERATURE_THRESHOLD, TEMPERATURE_CRITICAL, HUMIDITY_HIGH_THRESHOLD } from '../src/alert.js';

describe('Alerts', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should generate alert for high temperature', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    const reading = await recordTelemetry({ deviceId: device.id, temperature: 36, humidity: 50 });
    const alerts = await checkAlerts(reading);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('temperature_high');
  });

  it('should generate critical alert for extreme temperature', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    const reading = await recordTelemetry({ deviceId: device.id, temperature: 50, humidity: 50 });
    const alerts = await checkAlerts(reading);
    expect(alerts.some(a => a.type === 'temperature_critical')).toBe(true);
  });

  it('should generate alert for high humidity', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    const reading = await recordTelemetry({ deviceId: device.id, temperature: 20, humidity: 85 });
    const alerts = await checkAlerts(reading);
    expect(alerts.some(a => a.type === 'humidity_high')).toBe(true);
  });

  it('should retrieve alerts for a device', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    const reading = await recordTelemetry({ deviceId: device.id, temperature: 40, humidity: 50 });
    await checkAlerts(reading);
    const alerts = await getAlerts(device.id);
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('should acknowledge an alert', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    const reading = await recordTelemetry({ deviceId: device.id, temperature: 40, humidity: 50 });
    const alerts = await checkAlerts(reading);
    const updated = await acknowledgeAlert(alerts[0].id);
    expect(updated!.acknowledged).toBe(true);
  });
});
