import { PrismaClient, SeatClass, BookingStatus } from '@prisma/client';
import { AppError } from '../middleware/error.middleware.js';
import { generateBoardingPassCode } from '../utils/booking.utils.js';
import { calculateBaggageFee } from '../utils/baggage.utils.js';

const prisma = new PrismaClient();

export class BookingService {
  async createBooking(data: {
    flightId: string;
    seatId: string;
    passengerName: string;
    passengerEmail: string;
    bookingClass: SeatClass;
    baggageCount?: number;
  }) {
    // BUG: No capacity check before booking!
    // The system should verify that total bookings don't exceed aircraft capacity
    
    const flight = await prisma.flight.findUnique({
      where: { id: data.flightId },
      include: { aircraft: true },
    });

    if (!flight) {
      throw new AppError(404, 'Flight not found', 'FLIGHT_NOT_FOUND');
    }

    // Check if seat exists and is available
    const seat = await prisma.seat.findUnique({
      where: { id: data.seatId },
      include: { booking: true },
    });

    if (!seat) {
      throw new AppError(404, 'Seat not found', 'SEAT_NOT_FOUND');
    }

    if (seat.booking) {
      throw new AppError(409, 'Seat is already booked', 'SEAT_UNAVAILABLE');
    }

    if (seat.class !== data.bookingClass) {
      throw new AppError(400, 'Seat class does not match booking class', 'CLASS_MISMATCH');
    }

    // BUG: Missing capacity check!
    // Should check: total bookings for this flight < aircraft.totalSeats
    // But even that is flawed because it's a read-before-write race condition
    
    const baggageCount = data.baggageCount || 0;
    const baggageFee = calculateBaggageFee(data.bookingClass, baggageCount);
    const basePrice = flight.basePrice.toNumber();
    const classMultiplier = data.bookingClass === 'FIRST' ? 3 : data.bookingClass === 'BUSINESS' ? 2 : 1;
    const totalPrice = basePrice * classMultiplier + baggageFee;

    return prisma.booking.create({
      data: {
        flightId: data.flightId,
        seatId: data.seatId,
        passengerName: data.passengerName,
        passengerEmail: data.passengerEmail,
        bookingClass: data.bookingClass,
        baggageCount,
        totalBaggageWeight: baggageCount * 23,
        status: BookingStatus.CONFIRMED,
      },
      include: {
        flight: {
          include: {
            departureAirport: true,
            arrivalAirport: true,
          },
        },
        seat: true,
      },
    });
  }

  async getBooking(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        flight: {
          include: {
            departureAirport: true,
            arrivalAirport: true,
            aircraft: true,
          },
        },
        seat: true,
      },
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    return booking;
  }

  async checkIn(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError(400, 'Cannot check in cancelled booking', 'BOOKING_CANCELLED');
    }

    if (booking.checkedIn) {
      throw new AppError(400, 'Already checked in', 'ALREADY_CHECKED_IN');
    }

    return prisma.booking.update({
      where: { id },
      data: {
        checkedIn: true,
        status: BookingStatus.CHECKED_IN,
      },
    });
  }

  async generateBoardingPass(id: string) {
    const booking = await this.getBooking(id);

    if (!booking.checkedIn) {
      throw new AppError(400, 'Must check in first', 'NOT_CHECKED_IN');
    }

    const boardingPass = generateBoardingPassCode(booking);

    await prisma.booking.update({
      where: { id },
      data: { boardingPass },
    });

    return {
      ...booking,
      boardingPass,
    };
  }

  async cancelBooking(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError(400, 'Booking already cancelled', 'ALREADY_CANCELLED');
    }

    return prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
    });
  }
}
