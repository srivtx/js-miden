import { prisma } from '../utils/prisma.js';

interface TrackingEventInput {
  status: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export class TrackingService {
  async getTrackingByShipmentId(shipmentId: string) {
    return prisma.tracking.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addTrackingEvent(shipmentId: string, data: TrackingEventInput) {
    return prisma.tracking.create({
      data: {
        shipmentId,
        status: data.status as any,
        location: data.location,
        latitude: data.latitude,
        longitude: data.longitude,
        notes: data.notes,
      },
    });
  }
}
