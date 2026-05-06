import { Request, Response } from 'express';
import { TourService } from '../services/tourService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const tourService = new TourService();

export const bookTour = asyncHandler(async (req: Request, res: Response) => {
  const booking = await tourService.bookTour(req.body);
  res.status(201).json({ data: booking });
});

export const getBooking = asyncHandler(async (req: Request, res: Response) => {
  const booking = await tourService.getBookingById(req.params.id);
  res.json({ data: booking });
});

export const getListingTours = asyncHandler(async (req: Request, res: Response) => {
  const tours = await tourService.getListingTours(req.params.listingId);
  res.json({ data: tours });
});
