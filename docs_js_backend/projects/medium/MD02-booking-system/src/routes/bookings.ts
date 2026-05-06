import { Router } from 'express';
import * as bookingController from '../controllers/bookingController.js';

const router = Router();

router.post('/', bookingController.createBooking);
router.post('/hold', bookingController.holdSlot);
router.get('/my', bookingController.getUserBookings);
router.post('/:id/cancel', bookingController.cancelBooking);

export default router;
