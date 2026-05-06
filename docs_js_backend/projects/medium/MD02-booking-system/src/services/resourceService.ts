import { prisma } from '../db.js';

export async function getResources() {
  return prisma.resource.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function getResourceById(id: string) {
  const resource = await prisma.resource.findUnique({ where: { id } });
  if (!resource) throw Object.assign(new Error('Resource not found'), { statusCode: 404, code: 'NOT_FOUND' });
  return resource;
}

export async function getResourceAvailability(resourceId: string, start: Date, end: Date) {
  const resource = await getResourceById(resourceId);

  const bookings = await prisma.booking.findMany({
    where: {
      resourceId,
      status: 'CONFIRMED',
      // BUG: Improper time range check that allows overlapping bookings.
      // Using OR instead of AND allows some overlapping scenarios.
      OR: [
        { startTime: { gte: start, lte: end } },
        { endTime: { gte: start, lte: end } },
      ],
    },
  });

  const holds = await prisma.holdSlot.findMany({
    where: {
      resourceId,
      expiresAt: { gt: new Date() },
      OR: [
        { startTime: { gte: start, lte: end } },
        { endTime: { gte: start, lte: end } },
      ],
    },
  });

  return {
    resource,
    bookings,
    holds,
    isAvailable: bookings.length === 0 && holds.length === 0,
  };
}
