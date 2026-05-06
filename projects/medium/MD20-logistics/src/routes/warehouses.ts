import { Router } from 'express';
import { getWarehouses, getWarehouse, createWarehouse } from '../controllers/warehouses.js';

const router = Router();

router.get('/', getWarehouses);
router.post('/', createWarehouse);
router.get('/:id', getWarehouse);

export { router as warehouseRoutes };
