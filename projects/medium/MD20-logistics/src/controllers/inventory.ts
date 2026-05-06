import { Request, Response } from 'express';
import { InventoryService } from '../services/inventoryService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const inventoryService = new InventoryService();

export const getInventory = asyncHandler(async (req: Request, res: Response) => {
  const inventory = await inventoryService.getWarehouseInventory(req.params.warehouseId);
  res.json({ data: inventory });
});

export const updateInventory = asyncHandler(async (req: Request, res: Response) => {
  const item = await inventoryService.updateInventory(
    req.params.warehouseId,
    req.body.sku,
    req.body.quantity
  );
  res.json({ data: item });
});
