import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/storage.js';
import { registerDevice } from '../src/device.js';
import { createCommand, getPendingCommands, markCommandSent, acknowledgeCommand } from '../src/command.js';

describe('Commands', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('should create a pending command', async () => {
    const device = await registerDevice({ name: 'Light', type: 'switch' });
    const cmd = await createCommand(device.id, 'turn_on');
    expect(cmd.status).toBe('pending');
    expect(cmd.type).toBe('turn_on');
  });

  it('should list pending commands for a device', async () => {
    const device = await registerDevice({ name: 'Light', type: 'switch' });
    await createCommand(device.id, 'turn_on');
    await createCommand(device.id, 'turn_off');
    const pending = await getPendingCommands(device.id);
    expect(pending).toHaveLength(2);
  });

  it('should mark command as sent', async () => {
    const device = await registerDevice({ name: 'Light', type: 'switch' });
    const cmd = await createCommand(device.id, 'reboot');
    const updated = await markCommandSent(cmd.id);
    expect(updated!.status).toBe('sent');
    expect(updated!.sentAt).toBeDefined();
  });

  it('should acknowledge a command', async () => {
    const device = await registerDevice({ name: 'Light', type: 'switch' });
    const cmd = await createCommand(device.id, 'update_config', { brightness: 80 });
    const updated = await acknowledgeCommand(cmd.id);
    expect(updated!.status).toBe('acknowledged');
    expect(updated!.acknowledgedAt).toBeDefined();
  });
});
