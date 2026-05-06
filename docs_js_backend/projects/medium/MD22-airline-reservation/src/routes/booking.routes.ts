import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller.js';

const router = Router();
const controller = new BookingController();

router.post('/', controller.createBooking);
router.get('/:id', controller.getBooking);
router.post('/:id/checkin', controller.checkIn);
router.get('/:id/boarding-pass', controller.getBoardingPass);
router.post('/:id/cancel', controller.cancelBooking);

export { router as bookingRoutes };
