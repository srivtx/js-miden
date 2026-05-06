import { Request, Response } from 'express';
import { LessonService } from '../services/lessonService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const lessonService = new LessonService();

export const getLesson = asyncHandler(async (req: Request, res: Response) => {
  const lesson = await lessonService.getLessonById(req.params.id);
  res.json({ data: lesson });
});

export const getLessonQuizzes = asyncHandler(async (req: Request, res: Response) => {
  const quizzes = await lessonService.getLessonQuizzes(req.params.id);
  res.json({ data: quizzes });
});
