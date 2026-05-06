import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as bookingService from '../services/bookingService.js';
import { validateRequest } from '../middleware/validateRequest.js';

const createBookingSchema = z.object({
  body: z.object({
    resourceId: z.string().uuid(),
    userId: z.string(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    timezone: z.string().optional(),
  }),
});

const cancelBookingSchema = z.object({
  body: z.object({
    reason: z.string().optional(),
  }),
});

export const createBooking = [
  validateRequest(createBookingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const booking = await bookingService.createBooking(req.body);
      res.status(201).json({ data: booking });
    } catch (err) {
      next(err);
    }
  },
];

export const cancelBooking = [
  validateRequest(cancelBookingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

      const booking = await bookingService.cancelBooking(req.params.id, userId, req.body.reason);
      res.json({ data: booking });
    } catch (err) {
      next(err);
    }
  },
];

export const getUserBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) throw Object.assign(new Error('Unauthorized'), { statusCode: 401, code: 'UNAUTHORIZED' });

    const bookings = await bookingService.getUserBookings(userId);
    res.json({ data: bookings });
  } catch (err) {
    next(err);
  }
};

export const holdSlot = [
  validateRequest(createBookingSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hold = await bookingService.holdSlot(req.body);
      res.status(201).json({ data: hold });
    } catch (err) {
      next(err);
    }
  },
];
