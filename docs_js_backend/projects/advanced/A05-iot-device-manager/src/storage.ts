import { Device } from './device.js';
import { TelemetryReading } from './telemetry.js';
import { Alert } from './alert.js';
import { DeviceCommand } from './command.js';

class MemoryStorage {
  private devices = new Map<string, Device>();
  private telemetry: TelemetryReading[] = [];
  private alerts: Alert[] = [];
  private commands: DeviceCommand[] = [];

  async saveDevice(device: Device): Promise<void> {
    this.devices.set(device.id, device);
  }

  async getDevice(id: string): Promise<Device | null> {
    return this.devices.get(id) || null;
  }

  async getAllDevices(): Promise<Device[]> {
    return Array.from(this.devices.values());
  }

  async updateDevice(id: string, updates: Partial<Device>): Promise<Device | null> {
    const existing = this.devices.get(id);
    if (!existing) {
      return null;
    }
    const updated = { ...existing, ...updates };
    this.devices.set(id, updated);
    return updated;
  }

  async saveTelemetry(reading: TelemetryReading): Promise<void> {
    this.telemetry.push(reading);
  }

  async getTelemetryForDevice(deviceId: string, limit: number): Promise<TelemetryReading[]> {
    return this.telemetry
      .filter(t => t.deviceId === deviceId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async saveAlert(alert: Alert): Promise<void> {
    this.alerts.push(alert);
  }

  async getAlertsForDevice(deviceId: string): Promise<Alert[]> {
    return this.alerts
      .filter(a => a.deviceId === deviceId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  async updateAlert(alertId: string, updates: Partial<Alert>): Promise<Alert | null> {
    const idx = this.alerts.findIndex(a => a.id === alertId);
    if (idx === -1) return null;
    this.alerts[idx] = { ...this.alerts[idx], ...updates };
    return this.alerts[idx];
  }

  async saveCommand(command: DeviceCommand): Promise<void> {
    this.commands.push(command);
  }

  async getPendingCommandsForDevice(deviceId: string): Promise<DeviceCommand[]> {
    return this.commands
      .filter(c => c.deviceId === deviceId && c.status === 'pending')
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async updateCommand(commandId: string, updates: Partial<DeviceCommand>): Promise<DeviceCommand | null> {
    const idx = this.commands.findIndex(c => c.id === commandId);
    if (idx === -1) return null;
    this.commands[idx] = { ...this.commands[idx], ...updates };
    return this.commands[idx];
  }

  // Test helpers
  clear(): void {
    this.devices.clear();
    this.telemetry = [];
    this.alerts = [];
    this.commands = [];
  }
}

export const storage = new MemoryStorage();
