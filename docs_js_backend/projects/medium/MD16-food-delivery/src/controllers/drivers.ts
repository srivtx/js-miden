import { Request, Response } from 'express';
import { DriverService } from '../services/driverService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const driverService = new DriverService();

export const getAvailableDrivers = asyncHandler(async (_req: Request, res: Response) => {
  const drivers = await driverService.getAvailableDrivers();
  res.json({ data: drivers });
});

export const updateLocation = asyncHandler(async (req: Request, res: Response) => {
  const driver = await driverService.updateLocation(
    req.params.id,
    req.body.latitude,
    req.body.longitude
  );
  res.json({ data: driver });
});

export const getDriver = asyncHandler(async (req: Request, res: Response) => {
  const driver = await driverService.getDriverById(req.params.id);
  res.json({ data: driver });
});
