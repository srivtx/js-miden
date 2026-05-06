import { Router } from 'express';
import { searchListings, searchNearby } from '../controllers/search.js';

const router = Router();

router.get('/', searchListings);
router.get('/nearby', searchNearby);

export { router as searchRoutes };
