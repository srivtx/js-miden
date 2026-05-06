import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/storage.js';
import { registerDevice, getDevice, listDevices, updateDevice } from '../src/device.js';

describe('Device Management', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should register a device with unique ID', async () => {
    const device = await registerDevice({ name: 'Living Room Sensor', type: 'temperature' });
    expect(device.id).toBeDefined();
    expect(device.id).toMatch(/^dev_/);
    expect(device.status).toBe('offline');
    expect(device.authToken).toBeDefined();
  });

  it('should retrieve a device by ID', async () => {
    const device = await registerDevice({ name: 'Garden Sensor', type: 'humidity' });
    const found = await getDevice(device.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Garden Sensor');
  });

  it('should list all devices', async () => {
    await registerDevice({ name: 'A', type: 'temp' });
    await registerDevice({ name: 'B', type: 'temp' });
    const devices = await listDevices();
    expect(devices).toHaveLength(2);
  });

  it('should update device metadata', async () => {
    const device = await registerDevice({ name: 'Office', type: 'multi' });
    const updated = await updateDevice(device.id, { metadata: { location: '3rd floor' } });
    expect(updated!.metadata.location).toBe('3rd floor');
  });
});
