import { Request, Response } from 'express';
import { QuizService } from '../services/quizService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const quizService = new QuizService();

export const getQuiz = asyncHandler(async (req: Request, res: Response) => {
  const quiz = await quizService.getQuizById(req.params.id);
  res.json({ data: quiz });
});

export const submitQuiz = asyncHandler(async (req: Request, res: Response) => {
  const result = await quizService.submitQuiz(
    req.params.id,
    req.body.userId,
    req.body.answers
  );
  res.json({ data: result });
});

export const getQuizAttempts = asyncHandler(async (req: Request, res: Response) => {
  const attempts = await quizService.getUserAttempts(req.params.userId, req.params.quizId);
  res.json({ data: attempts });
});
