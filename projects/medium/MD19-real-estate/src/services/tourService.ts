import { prisma } from '../utils/prisma.js';

export class TourService {
  async bookTour(data: {
    listingId: string;
    userId: string;
    date: string;
    notes?: string;
  }) {
    return prisma.tourBooking.create({
      data: {
        listingId: data.listingId,
        userId: data.userId,
        date: new Date(data.date),
        notes: data.notes,
      },
      include: {
        listing: true,
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async getBookingById(id: string) {
    return prisma.tourBooking.findUnique({
      where: { id },
      include: {
        listing: true,
        user: {
          select: { id: true, name: true },
        },
      },
    });
  }

  async getListingTours(listingId: string) {
    return prisma.tourBooking.findMany({
      where: { listingId },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: 'asc' },
    });
  }
}
