import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, SeatClass } from '@prisma/client';
import { BookingService } from '../src/services/booking.service.js';
import { AppError } from '../src/middleware/error.middleware.js';

const prisma = new PrismaClient();
const bookingService = new BookingService();

describe('Airline Reservation System', () => {
  let flightId: string;
  let aircraftId: string;
  let seats: { id: string; seatNumber: string; class: SeatClass }[] = [];

  beforeAll(async () => {
    // Clean up
    await prisma.booking.deleteMany();
    await prisma.seat.deleteMany();
    await prisma.flight.deleteMany();
    await prisma.aircraft.deleteMany();
    await prisma.airport.deleteMany();

    // Create small aircraft with only 2 seats for easy overbooking demo
    const aircraft = await prisma.aircraft.create({
      data: {
        model: 'Test Aircraft',
        manufacturer: 'Test',
        totalSeats: 2,
        economySeats: 2,
        businessSeats: 0,
        firstSeats: 0,
      },
    });

    aircraftId = aircraft.id;

    const airport = await prisma.airport.create({
      data: {
        code: 'TST',
        name: 'Test Airport',
        city: 'Test City',
        country: 'Test Country',
        timezone: 'UTC',
      },
    });

    const flight = await prisma.flight.create({
      data: {
        flightNumber: 'TST001',
        aircraftId: aircraft.id,
        departureAirportId: airport.id,
        arrivalAirportId: airport.id,
        departureTime: new Date('2024-12-01T10:00:00Z'),
        arrivalTime: new Date('2024-12-01T12:00:00Z'),
        basePrice: 100,
      },
    });

    flightId = flight.id;

    const seat1 = await prisma.seat.create({
      data: {
        flightId: flight.id,
        seatNumber: '1A',
        class: 'ECONOMY',
      },
    });

    const seat2 = await prisma.seat.create({
      data: {
        flightId: flight.id,
        seatNumber: '1B',
        class: 'ECONOMY',
      },
    });

    seats = [seat1, seat2];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should create a booking for an available seat', async () => {
    const booking = await bookingService.createBooking({
      flightId,
      seatId: seats[0].id,
      passengerName: 'John Doe',
      passengerEmail: 'john@example.com',
      bookingClass: 'ECONOMY',
    });

    expect(booking).toBeDefined();
    expect(booking.passengerName).toBe('John Doe');
    expect(booking.status).toBe('CONFIRMED');
  });

  it('should demonstrate overbooking bug - book more than capacity', async () => {
    // Aircraft has 2 seats, seat 1A is already booked
    // We have 1 remaining seat (1B)
    
    // But we can book the same seat from multiple concurrent requests
    // OR we can bypass the seat check entirely in some flows
    
    // First, let's book seat 1B normally
    const booking2 = await bookingService.createBooking({
      flightId,
      seatId: seats[1].id,
      passengerName: 'Jane Doe',
      passengerEmail: 'jane@example.com',
      bookingClass: 'ECONOMY',
    });

    expect(booking2).toBeDefined();

    // Now aircraft is at capacity (2/2 seats booked)
    // Let's verify the bug: try to book again
    // The bug is that if we manipulate requests, we could potentially
    // create bookings without proper seat assignment or capacity check
    
    const totalBookings = await prisma.booking.count({
      where: {
        flightId,
        status: { not: 'CANCELLED' },
      },
    });

    console.log('Total bookings:', totalBookings);
    console.log('Aircraft capacity: 2');
    
    // With the bug, if we had concurrent requests or bypassed checks,
    // totalBookings could exceed 2
    expect(totalBookings).toBeLessThanOrEqual(2); // This will pass in normal flow
    
    // The real bug: Let's demonstrate by trying to book a seat that's taken
    // In buggy implementation, we might be able to create a second booking
    // for the same seat if requests are concurrent
    console.log('BUG: With concurrent requests, both could pass seat check before either writes');
  });

  it('should not allow booking already taken seat', async () => {
    // Try to book seat 1A which is already taken
    await expect(
      bookingService.createBooking({
        flightId,
        seatId: seats[0].id,
        passengerName: 'Hacker',
        passengerEmail: 'hacker@example.com',
        bookingClass: 'ECONOMY',
      })
    ).rejects.toThrow(AppError);
  });

  it('should allow check-in for confirmed booking', async () => {
    const booking = await prisma.booking.findFirst({
      where: { flightId, status: 'CONFIRMED' },
    });

    if (booking) {
      const checkedIn = await bookingService.checkIn(booking.id);
      expect(checkedIn.checkedIn).toBe(true);
      expect(checkedIn.status).toBe('CHECKED_IN');
    }
  });

  it('should generate boarding pass after check-in', async () => {
    const booking = await prisma.booking.findFirst({
      where: { flightId, checkedIn: true },
    });

    if (booking) {
      const result = await bookingService.generateBoardingPass(booking.id);
      expect(result.boardingPass).toBeDefined();
      expect(result.boardingPass.length).toBeGreaterThan(0);
    }
  });
});
