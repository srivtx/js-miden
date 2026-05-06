import { Request, Response, NextFunction } from 'express';
import * as analyticsService from '../services/analyticsService.js';

export const getUrlAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

    const analytics = await analyticsService.getUrlAnalytics(req.params.urlId);
    res.json({ data: analytics });
  } catch (err) {
    next(err);
  }
};

export const getAdminStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await analyticsService.getAdminStats();
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
};

export const flushAnalytics = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await analyticsService.flushAnalyticsBatch();
    res.json({ data: { flushed: count } });
  } catch (err) {
    next(err);
  }
};
