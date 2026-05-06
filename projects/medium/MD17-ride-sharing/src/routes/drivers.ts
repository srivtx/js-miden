import { Router } from 'express';
import { getAvailableDrivers, updateLocation, getDriver, toggleAvailability } from '../controllers/drivers.js';

const router = Router();

router.get('/available', getAvailableDrivers);
router.get('/:id', getDriver);
router.patch('/:id/location', updateLocation);
router.patch('/:id/availability', toggleAvailability);

export { router as driverRoutes };
