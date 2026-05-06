import { Request, Response } from 'express';
import { RestaurantService } from '../services/restaurantService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const restaurantService = new RestaurantService();

export const getRestaurants = asyncHandler(async (_req: Request, res: Response) => {
  const restaurants = await restaurantService.getAllRestaurants();
  res.json({ data: restaurants });
});

export const getRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await restaurantService.getRestaurantById(req.params.id);
  res.json({ data: restaurant });
});

export const getMenu = asyncHandler(async (req: Request, res: Response) => {
  const menu = await restaurantService.getMenuByRestaurantId(req.params.id);
  res.json({ data: menu });
});

export const createRestaurant = asyncHandler(async (req: Request, res: Response) => {
  const restaurant = await restaurantService.createRestaurant(req.body);
  res.status(201).json({ data: restaurant });
});
