import { Router } from 'express';
import { createOrder, getOrder, getCustomerOrders, updateOrderStatus, assignDriver } from '../controllers/orders.js';

const router = Router();

router.post('/', createOrder);
router.get('/customer/:customerId', getCustomerOrders);
router.get('/:id', getOrder);
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/assign', assignDriver);

export { router as orderRoutes };
