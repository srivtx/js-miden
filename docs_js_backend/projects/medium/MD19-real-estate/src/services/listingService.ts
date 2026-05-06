import { prisma } from '../utils/prisma.js';

export class ListingService {
  async getAllListings() {
    return prisma.listing.findMany({
      where: { status: 'ACTIVE' },
      include: {
        agent: {
          select: { id: true, name: true, phone: true },
        },
      },
    });
  }

  async getListingById(id: string) {
    return prisma.listing.findUnique({
      where: { id },
      include: {
        agent: {
          select: { id: true, name: true, phone: true },
        },
        tourBookings: {
          where: { status: 'CONFIRMED' },
        },
      },
    });
  }

  async createListing(data: {
    title: string;
    description?: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    price: number;
    beds: number;
    baths: number;
    sqft: number;
    latitude: number;
    longitude: number;
    propertyType: string;
    agentId?: string;
  }) {
    return prisma.listing.create({
      data,
    });
  }

  async updateListing(id: string, data: Partial<{
    title: string;
    description: string;
    price: number;
    status: string;
  }>) {
    return prisma.listing.update({
      where: { id },
      data,
    });
  }
}
