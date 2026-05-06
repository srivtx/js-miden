import { prisma } from '../utils/prisma.js';
import { ShipmentStatus } from '@prisma/client';

interface CreateShipmentInput {
  originId: string;
  destinationId: string;
  weight: number;
  createdBy: string;
}

export class ShipmentService {
  async createShipment(data: CreateShipmentInput) {
    const trackingNumber = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const shipment = await prisma.shipment.create({
      data: {
        trackingNumber,
        status: ShipmentStatus.CREATED,
        originId: data.originId,
        destinationId: data.destinationId,
        weight: data.weight,
        createdBy: data.createdBy,
      },
      include: {
        origin: true,
        destination: true,
      },
    });

    // Create initial tracking event
    await prisma.tracking.create({
      data: {
        shipmentId: shipment.id,
        status: ShipmentStatus.CREATED,
        notes: 'Shipment created',
      },
    });

    return shipment;
  }

  async getShipmentById(id: string) {
    return prisma.shipment.findUnique({
      where: { id },
      include: {
        origin: true,
        destination: true,
        tracking: {
          orderBy: { createdAt: 'desc' },
        },
        route: {
          include: {
            nodes: {
              include: { warehouse: true },
              orderBy: { sequence: 'asc' },
            },
          },
        },
      },
    });
  }

  async getShipmentByTrackingNumber(trackingNumber: string) {
    return prisma.shipment.findUnique({
      where: { trackingNumber },
      include: {
        origin: true,
        destination: true,
        tracking: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  // BUG: No eventual consistency - status updated in one place but tracking may lag
  async updateStatus(id: string, status: ShipmentStatus) {
    // Update shipment status
    const shipment = await prisma.shipment.update({
      where: { id },
      data: { status },
    });

    // BUG: Tracking event creation is separate and could fail
    // If this fails, the shipment status and tracking will be inconsistent
    try {
      await prisma.tracking.create({
        data: {
          shipmentId: id,
          status,
          notes: `Status updated to ${status}`,
        },
      });
    } catch (error) {
      // Tracking failed but shipment status was already updated!
      console.error('Failed to create tracking event:', error);
    }

    return shipment;
  }

  // BUG: Delivery confirmation updates shipment but tracking may not reflect it
  async confirmDelivery(id: string) {
    const shipment = await prisma.shipment.update({
      where: { id },
      data: {
        status: ShipmentStatus.DELIVERED,
        deliveredAt: new Date(),
      },
    });

    // BUG: If this tracking creation fails, shipment shows delivered
    // but tracking still shows previous status
    try {
      await prisma.tracking.create({
        data: {
          shipmentId: id,
          status: ShipmentStatus.DELIVERED,
          notes: 'Package delivered',
        },
      });
    } catch (error) {
      console.error('Failed to create delivery tracking event:', error);
    }

    return shipment;
  }
}
