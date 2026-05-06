import { Router } from 'express';
import { getTracking, updateTracking } from '../controllers/tracking.js';

const router = Router();

router.get('/:orderId', getTracking);
router.post('/:orderId', updateTracking);

export { router as trackingRoutes };
