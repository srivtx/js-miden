import { prisma } from '../utils/prisma.js';
import { RideStatus } from '@prisma/client';

interface RequestRideInput {
  riderId: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
}

export class RideService {
  async requestRide(data: RequestRideInput) {
    const distanceKm = this.calculateDistance(
      data.pickupLat,
      data.pickupLng,
      data.dropoffLat,
      data.dropoffLng
    );

    const estimatedMinutes = Math.ceil((distanceKm / 30) * 60); // 30 km/h avg

    // BUG: Surge pricing not atomic - reads demand, calculates, but demand may change
    const surgeMultiplier = await this.getSurgeMultiplier(data.pickupLat, data.pickupLng);

    const baseFare = 2.50;
    const distanceFare = distanceKm * 1.50;
    const timeFare = estimatedMinutes * 0.35;
    const totalFare = (baseFare + distanceFare + timeFare) * surgeMultiplier;

    return prisma.ride.create({
      data: {
        riderId: data.riderId,
        status: RideStatus.REQUESTED,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        baseFare,
        distanceFare,
        timeFare,
        surgeMultiplier,
        totalFare,
        distanceKm,
        estimatedMinutes,
      },
      include: {
        rider: { include: { user: true } },
      },
    });
  }

  async getRideById(id: string) {
    return prisma.ride.findUnique({
      where: { id },
      include: {
        rider: { include: { user: true } },
        driver: { include: { user: true } },
        review: true,
      },
    });
  }

  async acceptRide(id: string, driverId: string) {
    return prisma.ride.update({
      where: { id },
      data: {
        driverId,
        status: RideStatus.ACCEPTED,
      },
      include: {
        driver: { include: { user: true } },
      },
    });
  }

  async completeRide(id: string) {
    const ride = await prisma.ride.findUnique({
      where: { id },
    });

    if (!ride) {
      throw new Error('Ride not found');
    }

    const actualMinutes = ride.estimatedMinutes; // Simplified

    return prisma.ride.update({
      where: { id },
      data: {
        status: RideStatus.COMPLETED,
        actualMinutes,
      },
    });
  }

  async calculateFare(distanceKm: number, minutes: number, surge: number = 1.0) {
    const baseFare = 2.50;
    const distanceFare = distanceKm * 1.50;
    const timeFare = minutes * 0.35;
    const total = (baseFare + distanceFare + timeFare) * surge;

    return {
      baseFare,
      distanceFare,
      timeFare,
      surgeMultiplier: surge,
      total,
    };
  }

  // BUG: Surge pricing calculation is not atomic
  private async getSurgeMultiplier(lat: number, lng: number): Promise<number> {
    // Read current demand and supply
    const demandResult = await prisma.ride.groupBy({
      by: ['status'],
      where: {
        status: 'REQUESTED',
        pickupLat: { gte: lat - 0.1, lte: lat + 0.1 },
        pickupLng: { gte: lng - 0.1, lte: lng + 0.1 },
      },
      _count: {
        status: true,
      },
    });

    const demand = demandResult[0]?._count.status || 0;

    // BUG: Stale read - driver availability may have changed since this query
    const supplyResult = await prisma.driver.count({
      where: {
        isAvailable: true,
        latitude: { gte: lat - 0.1, lte: lat + 0.1 },
        longitude: { gte: lng - 0.1, lte: lng + 0.1 },
      },
    });

    const supply = supplyResult || 1;

    // Calculate ratio - if demand > supply, increase price
    const ratio = demand / supply;
    
    // BUG: Non-atomic calculation - demand or supply could change between queries
    let multiplier = 1.0;
    if (ratio > 2) multiplier = 2.5;
    else if (ratio > 1.5) multiplier = 2.0;
    else if (ratio > 1.0) multiplier = 1.5;

    return multiplier;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
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
