import { Request, Response } from 'express';
import { RouteService } from '../services/routeService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const routeService = new RouteService();

export const createRoute = asyncHandler(async (req: Request, res: Response) => {
  const route = await routeService.createRoute(req.body.shipmentId);
  res.status(201).json({ data: route });
});

export const getRoute = asyncHandler(async (req: Request, res: Response) => {
  const route = await routeService.getRouteByShipmentId(req.params.shipmentId);
  res.json({ data: route });
});

export const optimizeRoute = asyncHandler(async (req: Request, res: Response) => {
  const route = await routeService.optimizeRoute(req.params.id);
  res.json({ data: route });
});
