import { Device, DeviceRegistration } from '../types/device.types.js';
import { logger } from '../utils/logger.js';

const devices = new Map<string, Device>();

export class DeviceService {
  async register(data: DeviceRegistration): Promise<Device> {
    const device: Device = {
      id: crypto.randomUUID(),
      ...data,
      status: 'offline',
      registeredAt: new Date(),
      lastSeenAt: new Date(),
      metadata: data.metadata || {},
    };

    devices.set(device.id, device);
    logger.info({ deviceId: device.id }, 'Device registered');
    return device;
  }

  async getDevice(id: string): Promise<Device | null> {
    return devices.get(id) || null;
  }

  async updateStatus(id: string, status: Device['status']): Promise<Device | null> {
    const device = devices.get(id);
    if (!device) return null;

    device.status = status;
    device.lastSeenAt = new Date();
    devices.set(id, device);
    logger.debug({ deviceId: id, status }, 'Device status updated');
    return device;
  }

  async listDevices(): Promise<Device[]> {
    return Array.from(devices.values());
  }

  async deleteDevice(id: string): Promise<boolean> {
    const existed = devices.has(id);
    devices.delete(id);
    logger.info({ deviceId: id }, 'Device deleted');
    return existed;
  }
}

export const deviceService = new DeviceService();
