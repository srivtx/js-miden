import { Router } from 'express';
import { RoomController } from '../controllers/room.controller.js';

const router = Router();
const controller = new RoomController();

router.get('/', controller.listRooms);
router.get('/:id/availability', controller.checkAvailability);

export { router as roomRoutes };
