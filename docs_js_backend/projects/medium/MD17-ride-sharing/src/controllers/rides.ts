import { Request, Response } from 'express';
import { RideService } from '../services/rideService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const rideService = new RideService();

export const requestRide = asyncHandler(async (req: Request, res: Response) => {
  const ride = await rideService.requestRide(req.body);
  res.status(201).json({ data: ride });
});

export const getRide = asyncHandler(async (req: Request, res: Response) => {
  const ride = await rideService.getRideById(req.params.id);
  res.json({ data: ride });
});

export const acceptRide = asyncHandler(async (req: Request, res: Response) => {
  const ride = await rideService.acceptRide(req.params.id, req.body.driverId);
  res.json({ data: ride });
});

export const completeRide = asyncHandler(async (req: Request, res: Response) => {
  const ride = await rideService.completeRide(req.params.id);
  res.json({ data: ride });
});

export const getRideFare = asyncHandler(async (req: Request, res: Response) => {
  const fare = await rideService.calculateFare(
    Number(req.query.distance),
    Number(req.query.minutes),
    Number(req.query.surge)
  );
  res.json({ data: fare });
});
