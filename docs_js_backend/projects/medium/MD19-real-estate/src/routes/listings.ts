import { Router } from 'express';
import { getListings, getListing, createListing, updateListing } from '../controllers/listings.js';

const router = Router();

router.get('/', getListings);
router.post('/', createListing);
router.get('/:id', getListing);
router.patch('/:id', updateListing);

export { router as listingRoutes };
