import { storage } from './storage.js';

export interface DeviceCommand {
  id: string;
  deviceId: string;
  type: 'turn_on' | 'turn_off' | 'reboot' | 'update_config';
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'acknowledged' | 'failed';
  createdAt: number;
  sentAt?: number;
  acknowledgedAt?: number;
}

export async function createCommand(
  deviceId: string,
  type: DeviceCommand['type'],
  payload: Record<string, unknown> = {}
): Promise<DeviceCommand> {
  const command: DeviceCommand = {
    id: `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    deviceId,
    type,
    payload,
    status: 'pending',
    createdAt: Date.now(),
  };
  await storage.saveCommand(command);
  return command;
}

export async function getPendingCommands(deviceId: string): Promise<DeviceCommand[]> {
  return storage.getPendingCommandsForDevice(deviceId);
}

export async function markCommandSent(commandId: string): Promise<DeviceCommand | null> {
  return storage.updateCommand(commandId, { status: 'sent', sentAt: Date.now() });
}

export async function acknowledgeCommand(commandId: string): Promise<DeviceCommand | null> {
  return storage.updateCommand(commandId, { status: 'acknowledged', acknowledgedAt: Date.now() });
}
