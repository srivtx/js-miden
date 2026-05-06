import { Request, Response, NextFunction } from 'express';
import { RoomService } from '../services/room.service.js';
import { AppError } from '../middleware/error.middleware.js';

export class RoomController {
  private roomService = new RoomService();

  listRooms = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const rooms = await this.roomService.listRooms();
      res.json({ data: rooms });
    } catch (error) {
      next(error);
    }
  };

  checkAvailability = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { checkIn, checkOut } = req.query;

      if (!checkIn || !checkOut) {
        throw new AppError(400, 'checkIn and checkOut are required', 'MISSING_DATES');
      }

      const available = await this.roomService.checkAvailability(
        id,
        new Date(checkIn as string),
        new Date(checkOut as string)
      );

      res.json({ data: { available, roomId: id } });
    } catch (error) {
      next(error);
    }
  };
}
