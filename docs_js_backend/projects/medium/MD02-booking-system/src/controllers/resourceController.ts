import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as resourceService from '../services/resourceService.js';
import { validateRequest } from '../middleware/validateRequest.js';

const availabilitySchema = z.object({
  query: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
});

export const getResources = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const resources = await resourceService.getResources();
    res.json({ data: resources });
  } catch (err) {
    next(err);
  }
};

export const getResource = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resource = await resourceService.getResourceById(req.params.id);
    res.json({ data: resource });
  } catch (err) {
    next(err);
  }
};

export const getAvailability = [
  validateRequest(availabilitySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { start, end } = req.query as { start: string; end: string };
      const availability = await resourceService.getResourceAvailability(
        req.params.id,
        new Date(start),
        new Date(end)
      );
      res.json({ data: availability });
    } catch (err) {
      next(err);
    }
  },
];
