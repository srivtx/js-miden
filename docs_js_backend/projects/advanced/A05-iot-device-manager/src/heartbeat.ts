import { storage } from './storage.js';
import { Device } from './device.js';

export const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function heartbeat(deviceId: string): Promise<Device | null> {
  const device = await storage.getDevice(deviceId);
  if (!device) {
    return null;
  }

  const now = Date.now();
  const updates: Partial<Device> = {
    lastSeen: now,
    status: 'online',
  };

  return storage.updateDevice(deviceId, updates);
}

export async function markOfflineDevices(): Promise<string[]> {
  const devices = await storage.getAllDevices();
  const markedOffline: string[] = [];
  const now = Date.now();

  for (const device of devices) {
    if (device.status !== 'online') {
      continue;
    }

    // PHASE 2-3: In production, this should be an atomic DB operation
    // or use a distributed lock to prevent race conditions.
    // Simulate async I/O (e.g., writing to persistent store, publishing event)
    await new Promise(resolve => setTimeout(resolve, 15));

    // BUG: Race condition. We read device.lastSeen at loop start, then yield.
    // If a heartbeat arrives during the yield and updates lastSeen + status,
    // we still use the STALE lastSeen from our closure and may incorrectly
    // mark the device offline, overwriting the fresh 'online' status.
    if (now - device.lastSeen > OFFLINE_THRESHOLD_MS) {
      await storage.updateDevice(device.id, { status: 'offline' });
      markedOffline.push(device.id);
    }
  }

  return markedOffline;
}

export function startHeartbeatMonitor(intervalMs = 30000): ReturnType<typeof setInterval> {
  return setInterval(() => {
    markOfflineDevices().catch(err => {
      console.error('Heartbeat monitor error:', err);
    });
  }, intervalMs);
}
