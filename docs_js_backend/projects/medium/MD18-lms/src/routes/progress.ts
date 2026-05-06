import { Router } from 'express';
import { markComplete, getProgress, getCourseProgress } from '../controllers/progress.js';

const router = Router();

router.post('/complete', markComplete);
router.get('/user/:userId', getProgress);
router.get('/user/:userId/course/:courseId', getCourseProgress);

export { router as progressRoutes };
