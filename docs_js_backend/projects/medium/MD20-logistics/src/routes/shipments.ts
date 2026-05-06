import { Router } from 'express';
import { createShipment, getShipment, getShipmentByTracking, updateShipmentStatus, confirmDelivery } from '../controllers/shipments.js';

const router = Router();

router.post('/', createShipment);
router.get('/tracking/:trackingNumber', getShipmentByTracking);
router.get('/:id', getShipment);
router.patch('/:id/status', updateShipmentStatus);
router.patch('/:id/deliver', confirmDelivery);

export { router as shipmentRoutes };
