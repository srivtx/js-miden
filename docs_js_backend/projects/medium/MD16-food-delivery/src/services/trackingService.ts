import { prisma } from '../utils/prisma.js';

export class TrackingService {
  async getTrackingByOrderId(orderId: string) {
    return prisma.tracking.findMany({
      where: { orderId },
      orderBy: { timestamp: 'desc' },
    });
  }

  async updateTracking(orderId: string, latitude: number, longitude: number) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { tracking: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Calculate ETA based on distance
    const latestTracking = order.tracking[0];
    let etaMinutes = order.etaMinutes;

    if (latestTracking) {
      const distance = this.calculateDistance(
        latestTracking.latitude,
        latestTracking.longitude,
        latitude,
        longitude
      );
      // Average speed ~30 km/h in city
      etaMinutes = Math.ceil((distance / 30) * 60);
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { etaMinutes },
    });

    return prisma.tracking.create({
      data: {
        orderId,
        latitude,
        longitude,
      },
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
