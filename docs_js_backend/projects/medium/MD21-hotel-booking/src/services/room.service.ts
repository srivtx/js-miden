import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class RoomService {
  async listRooms() {
    return prisma.room.findMany({
      include: {
        roomType: true,
        hotel: true,
      },
    });
  }

  async checkAvailability(roomId: string, checkIn: Date, checkOut: Date) {
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        roomId,
        status: { not: 'CANCELLED' },
        AND: [
          { checkIn: { lt: checkOut } },
          { checkOut: { gt: checkIn } },
        ],
      },
    });

    return overlappingBookings.length === 0;
  }
}
