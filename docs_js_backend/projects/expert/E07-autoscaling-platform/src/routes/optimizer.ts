import { Router } from 'express';
import { optimize } from '../controllers/optimizerController.js';

const router = Router();
router.post('/', optimize);

export default router;
