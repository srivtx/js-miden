import { Request, Response, NextFunction } from 'express';
import { commandService } from '../services/command.service.js';
import { mqttService } from '../services/mqtt.service.js';

export async function sendCommand(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { deviceId } = req.params;
    const { type, payload } = req.body;

    const command = await commandService.createCommand(deviceId, type, payload);

    // Publish via MQTT
    await mqttService.publishCommand(deviceId, {
      commandId: command.id,
      type,
      payload,
    });

    await commandService.markAsSent(command.id);

    res.status(201).json(command);
  } catch (err) {
    next(err);
  }
}

export async function getPendingCommands(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { deviceId } = req.params;
    const commands = await commandService.getPendingCommands(deviceId);
    res.json(commands);
  } catch (err) {
    next(err);
  }
}

export async function acknowledgeCommand(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { commandId } = req.params;
    const command = await commandService.acknowledge(commandId);
    if (!command) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Command not found' } });
      return;
    }
    res.json(command);
  } catch (err) {
    next(err);
  }
}

export async function scheduleOta(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { deviceId } = req.params;
    const { firmwareUrl, version, checksum, scheduledAt } = req.body;

    const command = await commandService.scheduleOta(deviceId, {
      firmwareUrl,
      version,
      checksum,
      scheduledAt: new Date(scheduledAt),
    });

    res.status(201).json(command);
  } catch (err) {
    next(err);
  }
}
