import { Request, Response } from 'express';
import { TrackingService } from '../services/trackingService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const trackingService = new TrackingService();

export const getTracking = asyncHandler(async (req: Request, res: Response) => {
  const tracking = await trackingService.getTrackingByOrderId(req.params.orderId);
  res.json({ data: tracking });
});

export const updateTracking = asyncHandler(async (req: Request, res: Response) => {
  const tracking = await trackingService.updateTracking(
    req.params.orderId,
    req.body.latitude,
    req.body.longitude
  );
  res.json({ data: tracking });
});
