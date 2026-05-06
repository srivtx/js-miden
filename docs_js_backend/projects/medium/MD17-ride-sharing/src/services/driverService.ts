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
        rides: {
          where: {
            status: { in: ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'] },
          },
        },
      },
    });
  }

  async updateLocation(id: string, latitude: number, longitude: number) {
    // BUG: No timestamp validation - accepts stale location updates
    return prisma.driver.update({
      where: { id },
      data: {
        latitude,
        longitude,
      },
    });
  }

  async toggleAvailability(id: string, available: boolean) {
    return prisma.driver.update({
      where: { id },
      data: { isAvailable: available },
    });
  }
}
