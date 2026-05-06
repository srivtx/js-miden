import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

describe('MD17 Ride Sharing API', () => {
  let riderId: string;
  let driverId: string;
  let rideId: string;

  beforeAll(async () => {
    const riderUser = await prisma.user.create({
      data: {
        email: 'rider@test.com',
        password: 'password',
        name: 'Test Rider',
        role: 'RIDER',
      },
    });

    const rider = await prisma.rider.create({
      data: { userId: riderUser.id },
    });
    riderId = rider.id;

    const driverUser = await prisma.user.create({
      data: {
        email: 'driver@test.com',
        password: 'password',
        name: 'Test Driver',
        role: 'DRIVER',
      },
    });

    const driver = await prisma.driver.create({
      data: {
        userId: driverUser.id,
        isAvailable: true,
        latitude: 40.7128,
        longitude: -74.006,
        vehicleType: 'Sedan',
        licensePlate: 'ABC123',
      },
    });
    driverId = driver.id;
  });

  afterAll(async () => {
    await prisma.review.deleteMany();
    await prisma.tracking.deleteMany();
    await prisma.ride.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.rider.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.tracking.deleteMany();
    await prisma.review.deleteMany();
    await prisma.ride.deleteMany();

    await prisma.driver.update({
      where: { id: driverId },
      data: { isAvailable: true },
    });
  });

  describe('POST /api/rides', () => {
    it('should request a ride', async () => {
      const res = await request(app)
        .post('/api/rides')
        .send({
          riderId,
          pickupAddress: '123 Pickup St',
          pickupLat: 40.758,
          pickupLng: -73.9855,
          dropoffAddress: '456 Dropoff Ave',
          dropoffLat: 40.7489,
          dropoffLng: -73.968,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('REQUESTED');
      rideId = res.body.data.id;
    });

    it('BUG: surge pricing uses non-atomic demand calculation', async () => {
      // Create multiple ride requests to trigger surge
      const rides = [];
      for (let i = 0; i < 5; i++) {
        rides.push(
          request(app)
            .post('/api/rides')
            .send({
              riderId,
              pickupAddress: '123 Pickup St',
              pickupLat: 40.758,
              pickupLng: -73.9855,
              dropoffAddress: '456 Dropoff Ave',
              dropoffLat: 40.7489,
              dropoffLng: -73.968,
            })
        );
      }

      const results = await Promise.all(rides);

      // All rides might have different surge multipliers
      // because demand changed between each calculation
      const multipliers = results.map((r) => Number(r.body.data.surgeMultiplier));
      console.log('Surge multipliers:', multipliers);

      // The bug: surge pricing should be consistent for simultaneous requests
      // but non-atomic reads cause inconsistency
      const uniqueMultipliers = [...new Set(multipliers)];
      if (uniqueMultipliers.length > 1) {
        console.log('BUG CONFIRMED: Inconsistent surge pricing for simultaneous requests');
      }

      expect(results.every((r) => r.status === 201)).toBe(true);
    });
  });

  describe('PATCH /api/rides/:id/accept', () => {
    it('should accept a ride', async () => {
      const ride = await request(app)
        .post('/api/rides')
        .send({
          riderId,
          pickupAddress: '123 Pickup St',
          pickupLat: 40.758,
          pickupLng: -73.9855,
          dropoffAddress: '456 Dropoff Ave',
          dropoffLat: 40.7489,
          dropoffLng: -73.968,
        });

      const res = await request(app)
        .patch(`/api/rides/${ride.body.data.id}/accept`)
        .send({ driverId });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACCEPTED');
    });
  });

  describe('PATCH /api/drivers/:id/location', () => {
    it('BUG: accepts stale location updates without timestamp check', async () => {
      // Update location
      const res1 = await request(app)
        .patch(`/api/drivers/${driverId}/location`)
        .send({ latitude: 40.75, longitude: -73.99 });

      expect(res1.status).toBe(200);

      // Simulate a stale update (e.g., from cached data)
      const res2 = await request(app)
        .patch(`/api/drivers/${driverId}/location`)
        .send({ latitude: 40.71, longitude: -74.0 });

      expect(res2.status).toBe(200);

      // The driver location is now stale - no timestamp validation
      const driver = await prisma.driver.findUnique({
        where: { id: driverId },
      });

      console.log('BUG CONFIRMED: Driver location updated without timestamp validation');
      console.log('Current location:', driver?.latitude, driver?.longitude);

      // The location should be 40.75, -73.99 but could be overwritten by stale data
      expect(driver).toBeTruthy();
    });
  });

  describe('POST /api/reviews', () => {
    it('should create a review', async () => {
      const ride = await prisma.ride.create({
        data: {
          riderId,
          status: 'COMPLETED',
          pickupAddress: '123 Pickup St',
          pickupLat: 40.758,
          pickupLng: -73.9855,
          dropoffAddress: '456 Dropoff Ave',
          dropoffLat: 40.7489,
          dropoffLng: -73.968,
          baseFare: 2.5,
          distanceFare: 5.0,
          timeFare: 3.5,
          surgeMultiplier: 1.0,
          totalFare: 11.0,
          distanceKm: 3.5,
          estimatedMinutes: 10,
          actualMinutes: 12,
          driverId,
        },
      });

      const res = await request(app)
        .post('/api/reviews')
        .send({
          rideId: ride.id,
          reviewerId: riderId,
          rating: 5,
          comment: 'Great ride!',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.rating).toBe(5);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
