import { Request, Response, NextFunction } from 'express';
import { alertService } from '../services/alert.service.js';

export async function createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rule = await alertService.createRule(req.body);
    res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
}

export async function listRules(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rules = await alertService.listRules();
    res.json(rules);
  } catch (err) {
    next(err);
  }
}

export async function getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { deviceId } = req.params;
    const events = await alertService.getEvents(deviceId);
    res.json(events);
  } catch (err) {
    next(err);
  }
}
