import { Router } from 'express';
import { createReview, getRideReview } from '../controllers/reviews.js';

const router = Router();

router.post('/', createReview);
router.get('/ride/:rideId', getRideReview);

export { router as reviewRoutes };
