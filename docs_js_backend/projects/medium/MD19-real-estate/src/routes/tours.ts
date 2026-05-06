import { Router } from 'express';
import { bookTour, getBooking, getListingTours } from '../controllers/tours.js';

const router = Router();

router.post('/', bookTour);
router.get('/listing/:listingId', getListingTours);
router.get('/:id', getBooking);

export { router as tourRoutes };
