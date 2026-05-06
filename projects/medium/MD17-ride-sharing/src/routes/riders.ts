import { Router } from 'express';
import { getRider, getRiderRides } from '../controllers/riders.js';

const router = Router();

router.get('/:id', getRider);
router.get('/:id/rides', getRiderRides);

export { router as riderRoutes };
