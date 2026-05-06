import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.middleware.js';

const prisma = new PrismaClient();

export class ReviewService {
  async createReview(data: {
    employeeId: string;
    reviewerId: string;
    rating: number;
    feedback: string;
    goals: string[];
    periodStart: Date;
    periodEnd: Date;
  }) {
    if (data.rating < 1 || data.rating > 5) {
      throw new AppError(400, 'Rating must be between 1 and 5', 'INVALID_RATING');
    }

    return prisma.performanceReview.create({
      data,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async listReviews(employeeId: string) {
    return prisma.performanceReview.findMany({
      where: { employeeId },
      include: {
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { periodEnd: 'desc' },
    });
  }

  async getReview(id: string) {
    return prisma.performanceReview.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}
