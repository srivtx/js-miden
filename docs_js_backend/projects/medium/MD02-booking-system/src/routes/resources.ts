import { Router } from 'express';
import * as resourceController from '../controllers/resourceController.js';

const router = Router();

router.get('/', resourceController.getResources);
router.get('/:id', resourceController.getResource);
router.get('/:id/availability', resourceController.getAvailability);

export default router;
