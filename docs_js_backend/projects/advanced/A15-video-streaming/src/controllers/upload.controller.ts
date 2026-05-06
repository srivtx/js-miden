import { Request, Response, NextFunction } from 'express';
import { uploadService } from '../services/upload.service.js';
import { videoService } from '../services/video.service.js';
import { ApiError } from '../middleware/error.middleware.js';

export async function startUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { videoId, filename, mimeType, size } = req.body;
    const video = await videoService.getVideo(videoId);
    if (!video) {
      const error: ApiError = new Error('Video not found');
      error.statusCode = 404;
      throw error;
    }
    const result = await uploadService.startUpload(videoId, filename, mimeType, size);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function uploadChunk(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.params;
    await uploadService.processChunk(sessionId, req.body);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function finalizeUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { sessionId } = req.params;
    await uploadService.finalizeUpload(sessionId);
    res.json({ status: 'processing' });
  } catch (err) {
    next(err);
  }
}
