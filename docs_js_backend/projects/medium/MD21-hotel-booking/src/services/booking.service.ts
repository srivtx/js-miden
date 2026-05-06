import { PrismaClient, BookingStatus } from '@prisma/client';
import { AppError } from '../middleware/error.middleware.js';
import { RoomService } from './room.service.js';
import { calculateRefund } from '../utils/pricing.utils.js';

const prisma = new PrismaClient();

export class BookingService {
  private roomService = new RoomService();

  async createBooking(data: {
    roomId: string;
    guestEmail: string;
    guestName: string;
    checkIn: Date;
    checkOut: Date;
  }) {
    // BUG: Race condition here!
    // Step 1: Check availability (read operation)
    const isAvailable = await this.roomService.checkAvailability(
      data.roomId,
      data.checkIn,
      data.checkOut
    );

    if (!isAvailable) {
      throw new AppError(409, 'Room is not available for selected dates', 'ROOM_UNAVAILABLE');
    }

    // Simulate some processing delay to make race condition more likely
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 2: Create booking (write operation)
    // Another request could have booked the room between step 1 and 2!
    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
      include: { roomType: true },
    });

    if (!room) {
      throw new AppError(404, 'Room not found', 'ROOM_NOT_FOUND');
    }

    const nights = Math.ceil(
      (data.checkOut.getTime() - data.checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalPrice = room.roomType.basePrice.toNumber() * nights;

    return prisma.booking.create({
      data: {
        ...data,
        totalPrice,
        status: BookingStatus.CONFIRMED,
      },
    });
  }

  async getBooking(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { room: { include: { roomType: true, hotel: true } } },
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    return booking;
  }

  async cancelBooking(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new AppError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new AppError(400, 'Booking is already cancelled', 'ALREADY_CANCELLED');
    }

    const refundAmount = calculateRefund(
      booking.totalPrice.toNumber(),
      booking.cancellationPolicy,
      booking.checkIn
    );

    return prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        refundAmount,
      },
    });
  }
}
