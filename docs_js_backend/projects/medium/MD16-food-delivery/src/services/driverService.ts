import { prisma } from '../utils/prisma.js';

export class DriverService {
  async getAvailableDrivers() {
    return prisma.driver.findMany({
      where: { isAvailable: true },
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
      },
    });
  }

  async getDriverById(id: string) {
    return prisma.driver.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
        orders: {
          where: {
            status: { in: ['PLACED', 'PREPARING', 'READY', 'PICKED_UP'] },
          },
        },
      },
    });
  }

  async updateLocation(id: string, latitude: number, longitude: number) {
    return prisma.driver.update({
      where: { id },
      data: {
        latitude,
        longitude,
      },
    });
  }
}
