import { prisma } from '../utils/prisma.js';

export class RiderService {
  async getRiderById(id: string) {
    return prisma.rider.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
      },
    });
  }

  async getRiderRides(riderId: string) {
    return prisma.ride.findMany({
      where: { riderId },
      include: {
        driver: { include: { user: true } },
        review: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
