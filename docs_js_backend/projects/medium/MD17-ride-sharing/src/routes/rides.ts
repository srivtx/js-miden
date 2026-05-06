import { Router } from 'express';
import { requestRide, getRide, acceptRide, completeRide, getRideFare } from '../controllers/rides.js';

const router = Router();

router.post('/', requestRide);
router.get('/fare', getRideFare);
router.get('/:id', getRide);
router.patch('/:id/accept', acceptRide);
router.patch('/:id/complete', completeRide);

export { router as rideRoutes };
