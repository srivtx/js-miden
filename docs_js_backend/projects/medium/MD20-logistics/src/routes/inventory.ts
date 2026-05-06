import { Router } from 'express';
import { getInventory, updateInventory } from '../controllers/inventory.js';

const router = Router();

router.get('/:warehouseId', getInventory);
router.patch('/:warehouseId', updateInventory);

export { router as inventoryRoutes };
