import { Request, Response } from 'express';
import { ProgressService } from '../services/progressService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const progressService = new ProgressService();

export const markComplete = asyncHandler(async (req: Request, res: Response) => {
  const progress = await progressService.markLessonComplete(
    req.body.userId,
    req.body.lessonId
  );
  res.json({ data: progress });
});

export const getProgress = asyncHandler(async (req: Request, res: Response) => {
  const progress = await progressService.getUserProgress(req.params.userId);
  res.json({ data: progress });
});

export const getCourseProgress = asyncHandler(async (req: Request, res: Response) => {
  const progress = await progressService.getCourseProgress(
    req.params.userId,
    req.params.courseId
  );
  res.json({ data: progress });
});
