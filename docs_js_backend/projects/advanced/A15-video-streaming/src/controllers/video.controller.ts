import { Request, Response, NextFunction } from 'express';
import { videoService } from '../services/video.service.js';
import { ApiError } from '../middleware/error.middleware.js';

export async function createVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, description, duration, format, size } = req.body;
    const video = await videoService.createVideo({ title, description, duration, format, size });
    res.status(201).json(video);
  } catch (err) {
    next(err);
  }
}

export async function getVideo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const video = await videoService.getVideo(req.params.id);
    if (!video) {
      const error: ApiError = new Error('Video not found');
      error.statusCode = 404;
      throw error;
    }
    res.json(video);
  } catch (err) {
    next(err);
  }
}

export async function listVideos(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // In production: paginate, filter, sort
    res.json([]);
  } catch (err) {
    next(err);
  }
}
