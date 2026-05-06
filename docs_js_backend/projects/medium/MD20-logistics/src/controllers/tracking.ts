import { Request, Response } from 'express';
import { TrackingService } from '../services/trackingService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const trackingService = new TrackingService();

export const getTracking = asyncHandler(async (req: Request, res: Response) => {
  const tracking = await trackingService.getTrackingByShipmentId(req.params.shipmentId);
  res.json({ data: tracking });
});

export const addTrackingEvent = asyncHandler(async (req: Request, res: Response) => {
  const tracking = await trackingService.addTrackingEvent(
    req.params.shipmentId,
    req.body
  );
  res.status(201).json({ data: tracking });
});
