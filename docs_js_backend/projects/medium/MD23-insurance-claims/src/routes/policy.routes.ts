import { Router } from 'express';
import { PolicyController } from '../controllers/policy.controller.js';

const router = Router();
const controller = new PolicyController();

router.get('/', controller.listPolicies);
router.get('/:id', controller.getPolicy);

export { router as policyRoutes };
