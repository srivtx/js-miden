import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';

const prisma = new PrismaClient();

export class FlightService {
  async searchFlights(origin: string, destination: string, date: Date) {
    return prisma.flight.findMany({
      where: {
        departureAirport: {
          code: { equals: origin, mode: 'insensitive' },
        },
        arrivalAirport: {
          code: { equals: destination, mode: 'insensitive' },
        },
        departureTime: {
          gte: startOfDay(date),
          lte: endOfDay(date),
        },
        status: {
          not: 'CANCELLED',
        },
      },
      include: {
        aircraft: true,
        departureAirport: true,
        arrivalAirport: true,
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  not: 'CANCELLED',
                },
              },
            },
          },
        },
      },
    });
  }

  async getSeatMap(flightId: string) {
    const seats = await prisma.seat.findMany({
      where: { flightId },
      include: {
        booking: {
          select: {
            status: true,
          },
        },
      },
      orderBy: {
        seatNumber: 'asc',
      },
    });

    return seats.map(seat => ({
      ...seat,
      isAvailable: !seat.isBlocked && (!seat.booking || seat.booking.status === 'CANCELLED'),
    }));
  }

  async getFlightStatus(flightId: string) {
    const flight = await prisma.flight.findUnique({
      where: { id: flightId },
      include: {
        aircraft: true,
        departureAirport: true,
        arrivalAirport: true,
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  not: 'CANCELLED',
                },
              },
            },
          },
        },
      },
    });

    if (!flight) {
      throw new Error('Flight not found');
    }

    return {
      ...flight,
      capacity: flight.aircraft.totalSeats,
      bookedSeats: flight._count.bookings,
      availableSeats: flight.aircraft.totalSeats - flight._count.bookings,
    };
  }
}
