import { Router } from 'express';
import { getAvailableDrivers, updateLocation, getDriver } from '../controllers/drivers.js';

const router = Router();

router.get('/available', getAvailableDrivers);
router.get('/:id', getDriver);
router.patch('/:id/location', updateLocation);

export { router as driverRoutes };
