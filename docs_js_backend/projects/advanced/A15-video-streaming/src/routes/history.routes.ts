import { Router } from 'express';
import { recordWatch, getHistory, getRecommendations } from '../controllers/history.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { z } from 'zod';

const router = Router();

const recordWatchSchema = z.object({
  body: z.object({
    userId: z.string().min(1),
    position: z.number().min(0),
    duration: z.number().positive(),
  }),
});

router.post('/:id/watch', validate(recordWatchSchema), recordWatch);
router.get('/user/:userId', getHistory);
router.get('/user/:userId/recommendations', getRecommendations);

export default router;
