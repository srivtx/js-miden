import { Request, Response, NextFunction } from 'express';
import { historyService } from '../services/history.service.js';
import { recommendationService } from '../services/recommendation.service.js';

export async function recordWatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, position, duration } = req.body;
    const { id: videoId } = req.params;
    const entry = await historyService.recordWatch(userId, videoId, position, duration);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const history = await historyService.getHistory(userId);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

export async function getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.params;
    const limit = Number(req.query.limit) || 10;
    const recommendations = await recommendationService.getRecommendations(userId, limit);
    res.json(recommendations);
  } catch (err) {
    next(err);
  }
}
