import { Router } from 'express';
import { enqueueJob, getJobStatus, cancelJob } from './controller.js';

const router = Router();

router.post('/jobs', enqueueJob);
router.get('/jobs/:id', getJobStatus);
router.delete('/jobs/:id', cancelJob);

export { router as queueRouter };
