import { Request, Response } from 'express';
import { RiderService } from '../services/riderService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const riderService = new RiderService();

export const getRider = asyncHandler(async (req: Request, res: Response) => {
  const rider = await riderService.getRiderById(req.params.id);
  res.json({ data: rider });
});

export const getRiderRides = asyncHandler(async (req: Request, res: Response) => {
  const rides = await riderService.getRiderRides(req.params.id);
  res.json({ data: rides });
});
