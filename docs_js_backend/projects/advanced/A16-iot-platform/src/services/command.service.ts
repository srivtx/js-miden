import { logger } from '../utils/logger.js';
import { OtaUpdate } from '../types/device.types.js';

export interface Command {
  id: string;
  deviceId: string;
  type: 'ota' | 'reboot' | 'config' | 'custom';
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'acknowledged' | 'failed';
  createdAt: Date;
  sentAt?: Date;
}

const commands = new Map<string, Command>();

export class CommandService {
  async createCommand(deviceId: string, type: Command['type'], payload: Record<string, unknown>): Promise<Command> {
    const command: Command = {
      id: crypto.randomUUID(),
      deviceId,
      type,
      payload,
      status: 'pending',
      createdAt: new Date(),
    };

    commands.set(command.id, command);
    logger.info({ commandId: command.id, deviceId, type }, 'Command created');
    return command;
  }

  async getPendingCommands(deviceId: string): Promise<Command[]> {
    return Array.from(commands.values()).filter((c) => c.deviceId === deviceId && c.status === 'pending');
  }

  async markAsSent(commandId: string): Promise<Command | null> {
    const command = commands.get(commandId);
    if (!command) return null;
    command.status = 'sent';
    command.sentAt = new Date();
    commands.set(commandId, command);
    return command;
  }

  async acknowledge(commandId: string): Promise<Command | null> {
    const command = commands.get(commandId);
    if (!command) return null;
    command.status = 'acknowledged';
    commands.set(commandId, command);
    logger.info({ commandId }, 'Command acknowledged');
    return command;
  }

  async scheduleOta(deviceId: string, update: Omit<OtaUpdate, 'deviceId'>): Promise<Command> {
    return this.createCommand(deviceId, 'ota', {
      firmwareUrl: update.firmwareUrl,
      version: update.version,
      checksum: update.checksum,
      scheduledAt: update.scheduledAt,
    });
  }
}

export const commandService = new CommandService();
