import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/error.middleware.js';

const prisma = new PrismaClient();

export class AdjusterService {
  async listAdjusters() {
    return prisma.adjuster.findMany({
      include: {
        _count: {
          select: { claims: true },
        },
      },
    });
  }

  async getWorkload(adjusterId: string) {
    const adjuster = await prisma.adjuster.findUnique({
      where: { id: adjusterId },
      include: {
        claims: {
          where: {
            status: {
              in: ['SUBMITTED', 'UNDER_REVIEW'],
            },
          },
        },
      },
    });

    if (!adjuster) {
      throw new AppError(404, 'Adjuster not found', 'ADJUSTER_NOT_FOUND');
    }

    return {
      adjuster: {
        id: adjuster.id,
        name: adjuster.name,
      },
      activeClaims: adjuster.claims.length,
      claims: adjuster.claims,
    };
  }
}
