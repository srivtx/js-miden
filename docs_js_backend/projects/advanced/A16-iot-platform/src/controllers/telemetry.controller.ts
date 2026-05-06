import { Request, Response, NextFunction } from 'express';
import { telemetryService } from '../services/telemetry.service.js';
import { deviceService } from '../services/device.service.js';
import { alertService } from '../services/alert.service.js';

export async function ingestTelemetry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // BUG: No device authentication. Trusts the deviceId from body.
    const { deviceId, measurements } = req.body;

    await telemetryService.ingest({
      deviceId,
      timestamp: new Date(),
      measurements,
    });

    await deviceService.updateStatus(deviceId, 'online');
    const alerts = await alertService.evaluateRules(deviceId, measurements);

    res.status(201).json({ status: 'ingested', alerts });
  } catch (err) {
    next(err);
  }
}

export async function getTelemetry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { deviceId, measurement, start, end } = req.query;
    const points = await telemetryService.query({
      deviceId: deviceId as string,
      measurement: measurement as string,
      start: new Date(start as string),
      end: new Date(end as string),
    });
    res.json(points);
  } catch (err) {
    next(err);
  }
}

export async function getLatestTelemetry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const point = await telemetryService.getLatest(req.params.deviceId);
    if (!point) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No telemetry found' } });
      return;
    }
    res.json(point);
  } catch (err) {
    next(err);
  }
}
