import { PrismaClient } from '@prisma/client';
import { addDays, format } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  // Create hotel
  const hotel = await prisma.hotel.create({
    data: {
      name: 'Grand Plaza Hotel',
      address: '123 Main Street',
      city: 'New York',
      country: 'USA',
      stars: 4,
    },
  });

  // Create room types
  const standard = await prisma.roomType.create({
    data: {
      name: 'Standard Room',
      description: 'Comfortable room with city view',
      basePrice: 150.00,
      capacity: 2,
      amenities: ['WiFi', 'TV', 'Air Conditioning'],
    },
  });

  const deluxe = await prisma.roomType.create({
    data: {
      name: 'Deluxe Suite',
      description: 'Spacious suite with king bed',
      basePrice: 280.00,
      capacity: 3,
      amenities: ['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Ocean View'],
    },
  });

  // Create rooms - only 1 standard room to demonstrate race condition
  const room101 = await prisma.room.create({
    data: {
      hotelId: hotel.id,
      roomTypeId: standard.id,
      roomNumber: '101',
      floor: 1,
    },
  });

  const room102 = await prisma.room.create({
    data: {
      hotelId: hotel.id,
      roomTypeId: standard.id,
      roomNumber: '102',
      floor: 1,
    },
  });

  await prisma.room.create({
    data: {
      hotelId: hotel.id,
      roomTypeId: deluxe.id,
      roomNumber: '201',
      floor: 2,
    },
  });

  // Create pricing tiers
  const today = new Date();
  await prisma.pricingTier.create({
    data: {
      roomTypeId: standard.id,
      name: 'Weekend Rate',
      multiplier: 1.3,
      startDate: addDays(today, 5),
      endDate: addDays(today, 7),
    },
  });

  await prisma.pricingTier.create({
    data: {
      roomTypeId: deluxe.id,
      name: 'Holiday Rate',
      multiplier: 1.5,
      startDate: addDays(today, 10),
      endDate: addDays(today, 15),
    },
  });

  // Create an existing booking
  await prisma.booking.create({
    data: {
      roomId: room101.id,
      guestEmail: 'john@example.com',
      guestName: 'John Doe',
      checkIn: addDays(today, 1),
      checkOut: addDays(today, 3),
      totalPrice: 300.00,
      status: 'CONFIRMED',
    },
  });

  console.log('Seed data created successfully');
  console.log('Hotel:', hotel.name);
  console.log('Rooms: 101 (Standard), 102 (Standard), 201 (Deluxe)');
  console.log('Room 101 is booked from', format(addDays(today, 1), 'yyyy-MM-dd'), 'to', format(addDays(today, 3), 'yyyy-MM-dd'));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
