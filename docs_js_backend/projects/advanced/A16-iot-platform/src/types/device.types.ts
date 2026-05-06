export interface Device {
  id: string;
  name: string;
  type: string;
  firmwareVersion: string;
  status: DeviceStatus;
  registeredAt: Date;
  lastSeenAt: Date;
  metadata: Record<string, unknown>;
}

export type DeviceStatus = 'online' | 'offline' | 'sleeping' | 'error';

export interface DeviceRegistration {
  name: string;
  type: string;
  firmwareVersion: string;
  metadata?: Record<string, unknown>;
}

export interface OtaUpdate {
  deviceId: string;
  firmwareUrl: string;
  version: string;
  checksum: string;
  scheduledAt: Date;
}
