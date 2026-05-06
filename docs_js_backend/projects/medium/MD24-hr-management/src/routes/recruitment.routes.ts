import { Router } from 'express';
import { RecruitmentController } from '../controllers/recruitment.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
const controller = new RecruitmentController();

router.get('/applicants', authenticate, controller.listApplicants);
router.post('/applicants', authenticate, controller.createApplicant);
router.post('/applicants/:id/interview', authenticate, controller.scheduleInterview);
router.post('/applicants/:id/status', authenticate, controller.updateStatus);

export { router as recruitmentRoutes };
