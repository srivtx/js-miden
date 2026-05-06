import { Router } from 'express';
import { calculateMortgage } from '../controllers/calculator.js';

const router = Router();

router.get('/mortgage', calculateMortgage);

export { router as calculatorRoutes };
