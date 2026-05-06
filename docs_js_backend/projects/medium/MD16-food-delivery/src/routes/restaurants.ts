import { Router } from 'express';
import { getRestaurants, getRestaurant, getMenu, createRestaurant } from '../controllers/restaurants.js';

const router = Router();

router.get('/', getRestaurants);
router.post('/', createRestaurant);
router.get('/:id', getRestaurant);
router.get('/:id/menu', getMenu);

export { router as restaurantRoutes };
