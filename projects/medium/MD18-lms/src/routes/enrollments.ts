import { Router } from 'express';
import { enroll, getEnrollment, getUserEnrollments } from '../controllers/enrollments.js';

const router = Router();

router.post('/', enroll);
router.get('/user/:userId', getUserEnrollments);
router.get('/:id', getEnrollment);

export { router as enrollmentRoutes };
