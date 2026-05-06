import { Request, Response } from 'express';
import { ReviewService } from '../services/reviewService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const reviewService = new ReviewService();

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.createReview(req.body);
  res.status(201).json({ data: review });
});

export const getRideReview = asyncHandler(async (req: Request, res: Response) => {
  const review = await reviewService.getReviewByRideId(req.params.rideId);
  res.json({ data: review });
});
