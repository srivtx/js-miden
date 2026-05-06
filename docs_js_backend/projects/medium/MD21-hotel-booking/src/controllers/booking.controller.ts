import { Request, Response, NextFunction } from 'express';
import { BookingService } from '../services/booking.service.js';
import { AppError } from '../middleware/error.middleware.js';
import { createBookingSchema } from '../types/booking.types.js';
import { validateBody } from '../middleware/validation.middleware.js';

export class BookingController {
  private bookingService = new BookingService();

  createBooking = [
    validateBody(createBookingSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const booking = await this.bookingService.createBooking(req.body);
        res.status(201).json({ data: booking });
      } catch (error) {
        next(error);
      }
    },
  ];

  getBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const booking = await this.bookingService.getBooking(id);
      res.json({ data: booking });
    } catch (error) {
      next(error);
    }
  };

  cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const booking = await this.bookingService.cancelBooking(id);
      res.json({ data: booking });
    } catch (error) {
      next(error);
    }
  };
}
