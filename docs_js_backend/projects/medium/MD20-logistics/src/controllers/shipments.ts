import { Request, Response } from 'express';
import { ShipmentService } from '../services/shipmentService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const shipmentService = new ShipmentService();

export const createShipment = asyncHandler(async (req: Request, res: Response) => {
  const shipment = await shipmentService.createShipment(req.body);
  res.status(201).json({ data: shipment });
});

export const getShipment = asyncHandler(async (req: Request, res: Response) => {
  const shipment = await shipmentService.getShipmentById(req.params.id);
  res.json({ data: shipment });
});

export const getShipmentByTracking = asyncHandler(async (req: Request, res: Response) => {
  const shipment = await shipmentService.getShipmentByTrackingNumber(req.params.trackingNumber);
  res.json({ data: shipment });
});

export const updateShipmentStatus = asyncHandler(async (req: Request, res: Response) => {
  const shipment = await shipmentService.updateStatus(req.params.id, req.body.status);
  res.json({ data: shipment });
});

export const confirmDelivery = asyncHandler(async (req: Request, res: Response) => {
  const shipment = await shipmentService.confirmDelivery(req.params.id);
  res.json({ data: shipment });
});
