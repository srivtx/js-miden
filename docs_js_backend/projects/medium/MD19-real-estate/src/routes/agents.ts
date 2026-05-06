import { Router } from 'express';
import { getAgents, getAgent, matchAgent } from '../controllers/agents.js';

const router = Router();

router.get('/', getAgents);
router.get('/match', matchAgent);
router.get('/:id', getAgent);

export { router as agentRoutes };
