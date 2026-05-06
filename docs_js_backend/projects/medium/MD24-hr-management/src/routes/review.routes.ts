import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
const controller = new ReviewController();

router.post('/', authenticate, controller.createReview);
router.get('/', authenticate, controller.listReviews);
router.get('/:id', authenticate, controller.getReview);

export { router as reviewRoutes };
