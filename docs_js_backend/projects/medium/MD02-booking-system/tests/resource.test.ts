import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { prisma, disconnectDb } from '../src/db.js';

beforeAll(async () => {
  await prisma.booking.deleteMany();
  await prisma.holdSlot.deleteMany();
  await prisma.resource.deleteMany();

  await prisma.resource.create({
    data: { id: 'res-2', name: 'Room B', timezone: 'UTC' },
  });

  // Seed a confirmed booking
  await prisma.booking.create({
    data: {
      resourceId: 'res-2',
      userId: 'user-a',
      startTime: new Date('2025-07-01T09:00:00Z'),
      endTime: new Date('2025-07-01T10:00:00Z'),
      status: 'CONFIRMED',
    },
  });
});

afterAll(async () => {
  await disconnectDb();
});

describe('Resource API', () => {
  it('should get resource availability', async () => {
    const res = await request(app)
      .get('/resources/res-2/availability')
      .query({ start: '2025-07-01T08:00:00Z', end: '2025-07-01T12:00:00Z' });

    expect(res.status).toBe(200);
    expect(res.body.data.isAvailable).toBe(false);
  });

  it('should list resources', async () => {
    const res = await request(app)
      .get('/resources');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
