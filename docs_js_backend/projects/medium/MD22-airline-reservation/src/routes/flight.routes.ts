import { Router } from 'express';
import { FlightController } from '../controllers/flight.controller.js';

const router = Router();
const controller = new FlightController();

router.get('/', controller.searchFlights);
router.get('/:id/seats', controller.getSeatMap);
router.get('/:id/status', controller.getFlightStatus);

export { router as flightRoutes };
