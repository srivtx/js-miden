import { Router } from 'express';
import { getTracking, addTrackingEvent } from '../controllers/tracking.js';

const router = Router();

router.get('/:shipmentId', getTracking);
router.post('/:shipmentId', addTrackingEvent);

export { router as trackingRoutes };
