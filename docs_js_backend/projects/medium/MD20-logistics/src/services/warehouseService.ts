import { prisma } from '../utils/prisma.js';

export class WarehouseService {
  async getAllWarehouses() {
    return prisma.warehouse.findMany({
      include: {
        _count: {
          select: { inventory: true },
        },
      },
    });
  }

  async getWarehouseById(id: string) {
    return prisma.warehouse.findUnique({
      where: { id },
      include: {
        inventory: true,
      },
    });
  }

  async createWarehouse(data: {
    name: string;
    address: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    capacity?: number;
  }) {
    return prisma.warehouse.create({
      data,
    });
  }
}
