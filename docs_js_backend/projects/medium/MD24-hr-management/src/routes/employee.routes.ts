import { Router } from 'express';
import { EmployeeController } from '../controllers/employee.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();
const controller = new EmployeeController();

router.get('/', authenticate, controller.listEmployees);
router.get('/org-chart', authenticate, controller.getOrgChart);
router.get('/:id', authenticate, controller.getEmployee);

export { router as employeeRoutes };
