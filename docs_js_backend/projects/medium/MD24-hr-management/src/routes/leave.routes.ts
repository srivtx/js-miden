import { Router } from 'express';
import { LeaveController } from '../controllers/leave.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
const controller = new LeaveController();

router.post('/', authenticate, controller.submitLeave);
router.get('/', authenticate, controller.listLeaveRequests);
router.post('/:id/approve', authenticate, controller.approveLeave);
router.post('/:id/deny', authenticate, controller.denyLeave);

export { router as leaveRoutes };
