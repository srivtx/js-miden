import { Router } from 'express';
import { AdjusterController } from '../controllers/adjuster.controller.js';

const router = Router();
const controller = new AdjusterController();

router.get('/', controller.listAdjusters);
router.get('/:id/workload', controller.getWorkload);

export { router as adjusterRoutes };
