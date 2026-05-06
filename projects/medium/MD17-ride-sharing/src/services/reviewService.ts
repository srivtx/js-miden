import { prisma } from '../utils/prisma.js';

interface CreateReviewInput {
  rideId: string;
  reviewerId: string;
  rating: number;
  comment?: string;
}

export class ReviewService {
  async createReview(data: CreateReviewInput) {
    const review = await prisma.review.create({
      data: {
        rideId: data.rideId,
        reviewerId: data.reviewerId,
        rating: data.rating,
        comment: data.comment,
      },
    });

    // Update driver rating
    const ride = await prisma.ride.findUnique({
      where: { id: data.rideId },
      include: { driver: true },
    });

    if (ride?.driverId) {
      const allReviews = await prisma.review.findMany({
        where: {
          ride: { driverId: ride.driverId },
        },
      });

      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

      await prisma.driver.update({
        where: { id: ride.driverId },
        data: { rating: avgRating },
      });
    }

    return review;
  }

  async getReviewByRideId(rideId: string) {
    return prisma.review.findUnique({
      where: { rideId },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });
  }
}
