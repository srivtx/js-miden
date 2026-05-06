import { Router } from 'express';
import { getLesson, getLessonQuizzes } from '../controllers/lessons.js';

const router = Router();

router.get('/:id', getLesson);
router.get('/:id/quizzes', getLessonQuizzes);

export { router as lessonRoutes };
