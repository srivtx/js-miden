import { prisma } from '../db.js';
import { BookingInput } from '../types.js';
import { toUTC } from '../utils/timezone.js';
import { sendBookingConfirmation, sendCancellationEmail } from '../utils/email.js';
import { config } from '../config.js';

export async function createBooking(input: BookingInput) {
  const resource = await prisma.resource.findUnique({ where: { id: input.resourceId } });
  if (!resource) throw Object.assign(new Error('Resource not found'), { statusCode: 404, code: 'NOT_FOUND' });

  const startTime = toUTC(input.startTime, input.timezone || resource.timezone);
  const endTime = toUTC(input.endTime, input.timezone || resource.timezone);

  if (endTime <= startTime) {
    throw Object.assign(new Error('End time must be after start time'), { statusCode: 400, code: 'INVALID_TIME_RANGE' });
  }

  // BUG: The availability check in resourceService has a flawed overlap query.
  // This allows double-bookings in certain edge cases (e.g., one booking ends exactly when another starts,
  // or a new booking completely engulfs an existing one but doesn't touch the exact start/end times).
  // The proper check should be: startTime < existingEnd AND endTime > existingStart
  const availability = await prisma.booking.findMany({
    where: {
      resourceId: input.resourceId,
      status: 'CONFIRMED',
      OR: [
        { startTime: { gte: startTime, lte: endTime } },
        { endTime: { gte: startTime, lte: endTime } },
      ],
    },
  });

  if (availability.length > 0) {
    throw Object.assign(new Error('Time slot is not available'), { statusCode: 409, code: 'SLOT_UNAVAILABLE' });
  }

  const booking = await prisma.booking.create({
    data: {
      resourceId: input.resourceId,
      userId: input.userId,
      startTime,
      endTime,
      status: 'CONFIRMED',
    },
    include: { resource: true },
  });

  await sendBookingConfirmation({
    to: input.userId,
    bookingId: booking.id,
    resourceName: resource.name,
    startTime,
    endTime,
  });

  return booking;
}

export async function cancelBooking(bookingId: string, userId: string, reason?: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: { resource: true },
  });

  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404, code: 'NOT_FOUND' });
  if (booking.status === 'CANCELLED') {
    throw Object.assign(new Error('Booking is already cancelled'), { statusCode: 400, code: 'ALREADY_CANCELLED' });
  }

  const hoursUntilStart = (booking.startTime.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntilStart < config.cancellationPolicyHours) {
    throw Object.assign(
      new Error(`Cancellation must be at least ${config.cancellationPolicyHours} hours before start time`),
      { statusCode: 400, code: 'CANCELLATION_POLICY_VIOLATION' }
    );
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
    include: { resource: true },
  });

  await sendCancellationEmail({
    to: userId,
    bookingId,
    reason,
  });

  return updated;
}

export async function getUserBookings(userId: string) {
  return prisma.booking.findMany({
    where: { userId },
    orderBy: { startTime: 'asc' },
    include: { resource: true },
  });
}

export async function holdSlot(input: BookingInput) {
  const resource = await prisma.resource.findUnique({ where: { id: input.resourceId } });
  if (!resource) throw Object.assign(new Error('Resource not found'), { statusCode: 404, code: 'NOT_FOUND' });

  const startTime = toUTC(input.startTime, input.timezone || resource.timezone);
  const endTime = toUTC(input.endTime, input.timezone || resource.timezone);

  const hold = await prisma.holdSlot.create({
    data: {
      resourceId: input.resourceId,
      userId: input.userId,
      startTime,
      endTime,
      expiresAt: new Date(Date.now() + config.holdDurationMinutes * 60 * 1000),
    },
  });

  return hold;
}
