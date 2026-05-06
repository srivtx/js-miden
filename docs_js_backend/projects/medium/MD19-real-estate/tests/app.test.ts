import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/utils/prisma.js';

describe('MD19 Real Estate API', () => {
  let userId: string;
  let listingId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'buyer@test.com',
        password: 'password',
        name: 'Test Buyer',
        role: 'BUYER',
      },
    });
    userId = user.id;

    // Create test listings with similar addresses to test LIKE search
    const listings = [];
    for (let i = 0; i < 10; i++) {
      listings.push({
        title: `Property ${i}`,
        address: `${100 + i} Main Street`,
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        price: 500000 + i * 50000,
        beds: 2 + (i % 3),
        baths: 2 + (i % 2),
        sqft: 1000 + i * 100,
        latitude: 40.7128 + (i * 0.001),
        longitude: -74.006 + (i * 0.001),
        propertyType: i % 2 === 0 ? 'HOUSE' : 'APARTMENT',
        status: 'ACTIVE',
      });
    }

    for (const listing of listings) {
      await prisma.listing.create({ data: listing });
    }

    const listing = await prisma.listing.create({
      data: {
        title: 'Test Property',
        address: '123 Test Ave',
        city: 'Brooklyn',
        state: 'NY',
        zipCode: '11201',
        price: 750000,
        beds: 3,
        baths: 2,
        sqft: 1500,
        latitude: 40.6782,
        longitude: -73.9442,
        propertyType: 'HOUSE',
        status: 'ACTIVE',
      },
    });
    listingId = listing.id;
  });

  afterAll(async () => {
    await prisma.tourBooking.deleteMany();
    await prisma.listing.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.tourBooking.deleteMany();
  });

  describe('GET /api/listings', () => {
    it('should return all listings', async () => {
      const res = await request(app).get('/api/listings');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/search', () => {
    it('BUG: slow search using LIKE on address', async () => {
      const start = Date.now();
      const res = await request(app)
        .get('/api/search')
        .query({ location: 'Main' });
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      console.log(`Search took ${duration}ms`);
      console.log('BUG: LIKE search on address is slow with many listings');

      // With millions of listings, this would be very slow
      expect(res.body.data).toBeInstanceOf(Array);
    });

    it('should filter by price range', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ minPrice: 600000, maxPrice: 800000 });

      expect(res.status).toBe(200);
      expect(res.body.data.every((l: any) => l.price >= 600000 && l.price <= 800000)).toBe(true);
    });

    it('should filter by beds', async () => {
      const res = await request(app)
        .get('/api/search')
        .query({ beds: 3 });

      expect(res.status).toBe(200);
      expect(res.body.data.every((l: any) => l.beds >= 3)).toBe(true);
    });
  });

  describe('GET /api/search/nearby', () => {
    it('BUG: no geospatial indexing for nearby search', async () => {
      const start = Date.now();
      const res = await request(app)
        .get('/api/search/nearby')
        .query({ lat: 40.7128, lng: -74.006, radius: 5 });
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      console.log(`Nearby search took ${duration}ms`);
      console.log('BUG: Fetching all listings and filtering in memory is inefficient');

      // This approach fetches ALL listings from DB and filters in memory
      // With millions of listings, this is extremely slow and memory-intensive
      expect(res.body.data).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/tours', () => {
    it('should book a tour', async () => {
      const res = await request(app)
        .post('/api/tours')
        .send({
          listingId,
          userId,
          date: new Date(Date.now() + 86400000).toISOString(),
          notes: 'Please call before arriving',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
    });
  });

  describe('GET /api/calculator/mortgage', () => {
    it('should calculate mortgage', async () => {
      const res = await request(app)
        .get('/api/calculator/mortgage')
        .query({
          price: 500000,
          downPayment: 100000,
          interestRate: 4.5,
          years: 30,
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('monthlyPayment');
      expect(res.body.data.monthlyPayment).toBeGreaterThan(0);
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
