import { Response, NextFunction } from 'express';
import { ReviewService } from '../services/review.service.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export class ReviewController {
  private reviewService = new ReviewService();

  createReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { employeeId, rating, feedback, goals, periodStart, periodEnd } = req.body;
      const reviewerId = req.user!.id;

      const review = await this.reviewService.createReview({
        employeeId,
        reviewerId,
        rating,
        feedback,
        goals,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
      });

      res.status(201).json({ data: review });
    } catch (error) {
      next(error);
    }
  };

  listReviews = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const employeeId = req.user!.id;
      const reviews = await this.reviewService.listReviews(employeeId);
      res.json({ data: reviews });
    } catch (error) {
      next(error);
    }
  };

  getReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const review = await this.reviewService.getReview(id);
      res.json({ data: review });
    } catch (error) {
      next(error);
    }
  };
}
