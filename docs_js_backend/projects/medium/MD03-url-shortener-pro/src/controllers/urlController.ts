import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as urlService from '../services/urlService.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { rateLimitShorten } from '../middleware/rateLimiter.js';

const createUrlSchema = z.object({
  body: z.object({
    originalUrl: z.string().url(),
    customAlias: z.string().min(3).max(50).optional(),
    expiresAt: z.string().datetime().optional(),
  }),
});

export const createUrl = [
  rateLimitShorten,
  validateRequest(createUrlSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers['x-user-id'] as string | undefined;
      const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : undefined;
      const url = await urlService.createShortUrl(req.body.originalUrl, req.body.customAlias, userId, expiresAt);
      res.status(201).json({ data: url });
    } catch (err) {
      next(err);
    }
  },
];

export const getUserUrls = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

    const urls = await urlService.getUrlsByUser(userId);
    res.json({ data: urls });
  } catch (err) {
    next(err);
  }
};

export const deleteUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

    await urlService.deleteUrl(req.params.shortCode, userId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
