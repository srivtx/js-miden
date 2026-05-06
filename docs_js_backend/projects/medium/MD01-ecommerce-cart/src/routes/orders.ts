import { Router } from 'express';
import * as orderController from '../controllers/orderController.js';

const router = Router();

router.post('/checkout', orderController.checkout);
router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrder);

export default router;
