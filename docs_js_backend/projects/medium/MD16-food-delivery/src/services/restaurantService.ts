import { prisma } from '../utils/prisma.js';

export class RestaurantService {
  async getAllRestaurants() {
    return prisma.restaurant.findMany({
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });
  }

  async getRestaurantById(id: string) {
    return prisma.restaurant.findUnique({
      where: { id },
      include: {
        menus: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async getMenuByRestaurantId(restaurantId: string) {
    return prisma.menu.findMany({
      where: { restaurantId, isAvailable: true },
    });
  }

  async createRestaurant(data: {
    name: string;
    description?: string;
    address: string;
    latitude: number;
    longitude: number;
    cuisine: string;
    ownerId: string;
  }) {
    return prisma.restaurant.create({
      data,
    });
  }
}
