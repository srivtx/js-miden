import { Router } from 'express';
import { setRule, getRule, registerWorkload, getWorkload, evaluate } from '../controllers/scalingController.js';

const router = Router();
router.post('/rules', setRule);
router.get('/rules/:workloadId', getRule);
router.post('/workloads', registerWorkload);
router.get('/workloads/:workloadId', getWorkload);
router.post('/evaluate', evaluate);

export default router;
