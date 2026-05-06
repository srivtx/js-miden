import { Router } from 'express';
import { createRoute, getRoute, optimizeRoute } from '../controllers/routes.js';

const router = Router();

router.post('/', createRoute);
router.get('/shipment/:shipmentId', getRoute);
router.patch('/:id/optimize', optimizeRoute);

export { router as routeRoutes };
