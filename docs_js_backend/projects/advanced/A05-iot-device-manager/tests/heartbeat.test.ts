import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../src/storage.js';
import { registerDevice } from '../src/device.js';
import { heartbeat, markOfflineDevices, OFFLINE_THRESHOLD_MS } from '../src/heartbeat.js';

describe('Heartbeat', () => {
  beforeEach(() => {
    storage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should mark device online on heartbeat', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    const updated = await heartbeat(device.id);
    expect(updated!.status).toBe('online');
    expect(updated!.lastSeen).toBeGreaterThan(0);
  });

  it('should mark device offline after threshold', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    await heartbeat(device.id);

    vi.advanceTimersByTime(OFFLINE_THRESHOLD_MS + 1000);
    const marked = await markOfflineDevices();
    expect(marked).toContain(device.id);

    const offline = await storage.getDevice(device.id);
    expect(offline!.status).toBe('offline');
  });

  it('should NOT mark recent heartbeat device offline', async () => {
    const device = await registerDevice({ name: 'Sensor', type: 'temp' });
    await heartbeat(device.id);
    vi.advanceTimersByTime(1000);

    const marked = await markOfflineDevices();
    expect(marked).not.toContain(device.id);
  });

  // This test demonstrates the heartbeat race condition bug.
  // The markOfflineDevices loop yields (await) between reading device data
  // and checking the threshold. If a heartbeat arrives during that yield,
  // the stale lastSeen from the closure is used, incorrectly marking the
  // device offline.
  it('should NOT mark device offline if heartbeat arrives during offline check', async () => {
    vi.useRealTimers(); // Real timers needed for interleaving

    const device = await registerDevice({ name: 'Sensor', type: 'temp' });

    // Simulate an old heartbeat so the device WOULD be marked offline
    // if we only looked at the stale data
    await storage.updateDevice(device.id, {
      lastSeen: Date.now() - OFFLINE_THRESHOLD_MS - 1000,
      status: 'online',
    });

    // Start the offline check. Inside markOfflineDevices, it reads the device,
    // then awaits a 15ms delay. During that delay, we send a fresh heartbeat.
    const checkPromise = markOfflineDevices();

    // Wait until we're inside the async delay of markOfflineDevices
    await new Promise(resolve => setTimeout(resolve, 5));

    // Fresh heartbeat arrives during the offline check
    await heartbeat(device.id);

    await checkPromise;

    // EXPECTED: Device should still be online because the heartbeat was recent.
    // ACTUAL (BUG): Device is marked offline because markOfflineDevices uses
    // the stale `lastSeen` captured before the await, not the updated value.
    const finalDevice = await storage.getDevice(device.id);
    expect(finalDevice!.status).toBe('online');
  });
});
