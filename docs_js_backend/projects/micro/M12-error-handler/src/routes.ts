import { Router } from 'express';
import { AppError } from './errors.js';

export const router = Router();

// 400 - Bad Request
router.post('/divide', (req, res, next) => {
  const { a, b } = req.body as { a?: number; b?: number };
  if (typeof a !== 'number' || typeof b !== 'number') {
    next(new AppError(400, 'Bad Request', 'Both a and b must be numbers'));
    return;
  }
  if (b === 0) {
    next(new AppError(400, 'Bad Request', 'Division by zero is not allowed'));
    return;
  }
  res.json({ result: a / b });
});

// 500 - Async error
router.get('/async-error', async (_req, _res, next) => {
  try {
    await Promise.reject(new Error('Database connection lost'));
  } catch (err) {
    next(err as Error);
  }
});

// Trigger headers-sent bug scenario
router.get('/headers-sent', (req, res, next) => {
  res.status(200).json({ ok: true });
  // Simulate an error after response has been sent
  next(new Error('Cleanup failed after response'));
});
