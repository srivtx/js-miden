import { Request, Response, NextFunction } from 'express';
import { deviceService } from '../services/device.service.js';
import { ApiError } from '../middleware/error.middleware.js';

export async function registerDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const device = await deviceService.register(req.body);
    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
}

export async function getDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const device = await deviceService.getDevice(req.params.id);
    if (!device) {
      const error: ApiError = new Error('Device not found');
      error.statusCode = 404;
      throw error;
    }
    res.json(device);
  } catch (err) {
    next(err);
  }
}

export async function listDevices(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const devices = await deviceService.listDevices();
    res.json(devices);
  } catch (err) {
    next(err);
  }
}

export async function deleteDevice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deviceService.deleteDevice(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
