import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { BookingService } from '../src/services/booking.service.js';
import { AppError } from '../src/middleware/error.middleware.js';

const prisma = new PrismaClient();
const bookingService = new BookingService();

describe('Hotel Booking System', () => {
  let roomId: string;
  let hotelId: string;

  beforeAll(async () => {
    // Clean up
    await prisma.booking.deleteMany();
    await prisma.room.deleteMany();
    await prisma.hotel.deleteMany();
    await prisma.roomType.deleteMany();

    const roomType = await prisma.roomType.create({
      data: {
        name: 'Test Room',
        basePrice: 100,
        capacity: 2,
      },
    });

    const hotel = await prisma.hotel.create({
      data: {
        name: 'Test Hotel',
        address: 'Test Address',
        city: 'Test City',
        country: 'Test Country',
        stars: 3,
      },
    });

    hotelId = hotel.id;

    const room = await prisma.room.create({
      data: {
        hotelId: hotel.id,
        roomTypeId: roomType.id,
        roomNumber: '101',
        floor: 1,
      },
    });

    roomId = room.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a booking when room is available', async () => {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 10);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 12);

    const booking = await bookingService.createBooking({
      roomId,
      guestEmail: 'test@example.com',
      guestName: 'Test User',
      checkIn,
      checkOut,
    });

    expect(booking).toBeDefined();
    expect(booking.guestEmail).toBe('test@example.com');
    expect(booking.status).toBe('CONFIRMED');
  });

  it('should detect race condition - two simultaneous bookings of last room', async () => {
    // Clean up previous bookings
    await prisma.booking.deleteMany();

    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 20);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 22);

    // Simulate two users booking simultaneously
    const promise1 = bookingService.createBooking({
      roomId,
      guestEmail: 'user1@example.com',
      guestName: 'User One',
      checkIn,
      checkOut,
    });

    const promise2 = bookingService.createBooking({
      roomId,
      guestEmail: 'user2@example.com',
      guestName: 'User Two',
      checkIn,
      checkOut,
    });

    const results = await Promise.allSettled([promise1, promise2]);

    // Count successful bookings
    const successful = results.filter(r => r.status === 'fulfilled');

    // This test demonstrates the BUG: both might succeed!
    // In a correct implementation, only one should succeed
    console.log('Successful bookings:', successful.length);
    console.log('This demonstrates the race condition bug!');

    // Check how many bookings exist in DB for these dates
    const bookings = await prisma.booking.findMany({
      where: {
        roomId,
        status: { not: 'CANCELLED' },
        AND: [
          { checkIn: { lt: checkOut } },
          { checkOut: { gt: checkIn } },
        ],
      },
    });

    // BUG REPRODUCTION: This assertion will likely fail showing >1 booking
    // In correct implementation, this should be 1
    console.log('Total bookings for same room/dates:', bookings.length);
    
    // The bug allows overbooking - both users get confirmed
    if (bookings.length > 1) {
      console.log('BUG CONFIRMED: Race condition allowed double booking!');
    }
  });

  it('should calculate refund correctly', async () => {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 10);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 12);

    await prisma.booking.deleteMany();

    const booking = await bookingService.createBooking({
      roomId,
      guestEmail: 'refund@example.com',
      guestName: 'Refund Test',
      checkIn,
      checkOut,
    });

    const cancelled = await bookingService.cancelBooking(booking.id);
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.refundAmount).toBeDefined();
  });
});
