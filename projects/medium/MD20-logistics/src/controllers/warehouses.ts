import { Request, Response } from 'express';
import { WarehouseService } from '../services/warehouseService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const warehouseService = new WarehouseService();

export const getWarehouses = asyncHandler(async (_req: Request, res: Response) => {
  const warehouses = await warehouseService.getAllWarehouses();
  res.json({ data: warehouses });
});

export const getWarehouse = asyncHandler(async (req: Request, res: Response) => {
  const warehouse = await warehouseService.getWarehouseById(req.params.id);
  res.json({ data: warehouse });
});

export const createWarehouse = asyncHandler(async (req: Request, res: Response) => {
  const warehouse = await warehouseService.createWarehouse(req.body);
  res.status(201).json({ data: warehouse });
});
