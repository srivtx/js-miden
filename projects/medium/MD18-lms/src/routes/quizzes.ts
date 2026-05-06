import { Router } from 'express';
import { getQuiz, submitQuiz, getQuizAttempts } from '../controllers/quizzes.js';

const router = Router();

router.get('/:id', getQuiz);
router.post('/:id/submit', submitQuiz);
router.get('/:quizId/attempts/:userId', getQuizAttempts);

export { router as quizRoutes };
