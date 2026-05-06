import { PrismaClient } from '@prisma/client';
import { addDays, addHours } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  // Create aircraft - Boeing 737 with 150 seats (130 economy, 20 business)
  const aircraft = await prisma.aircraft.create({
    data: {
      model: 'Boeing 737-800',
      manufacturer: 'Boeing',
      totalSeats: 150,
      economySeats: 130,
      businessSeats: 20,
      firstSeats: 0,
    },
  });

  // Create airports
  const jfk = await prisma.airport.create({
    data: {
      code: 'JFK',
      name: 'John F. Kennedy International',
      city: 'New York',
      country: 'USA',
      timezone: 'America/New_York',
    },
  });

  const lax = await prisma.airport.create({
    data: {
      code: 'LAX',
      name: 'Los Angeles International',
      city: 'Los Angeles',
      country: 'USA',
      timezone: 'America/Los_Angeles',
    },
  });

  const lhr = await prisma.airport.create({
    data: {
      code: 'LHR',
      name: 'Heathrow Airport',
      city: 'London',
      country: 'UK',
      timezone: 'Europe/London',
    },
  });

  // Create flight
  const tomorrow = addDays(new Date(), 1);
  const departureTime = new Date(tomorrow);
  departureTime.setHours(8, 0, 0, 0);
  const arrivalTime = addHours(departureTime, 6);

  const flight = await prisma.flight.create({
    data: {
      flightNumber: 'AA101',
      aircraftId: aircraft.id,
      departureAirportId: jfk.id,
      arrivalAirportId: lax.id,
      departureTime,
      arrivalTime,
      basePrice: 299.99,
    },
  });

  // Create seats
  const seats = [];
  
  // Business class seats (1-20)
  for (let i = 1; i <= 20; i++) {
    seats.push({
      flightId: flight.id,
      seatNumber: `1${String(i).padStart(2, '0')}`,
      class: 'BUSINESS' as const,
    });
  }

  // Economy class seats (21-150)
  for (let i = 21; i <= 150; i++) {
    const row = Math.ceil((i - 20) / 6) + 1;
    const col = ((i - 21) % 6);
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    seats.push({
      flightId: flight.id,
      seatNumber: `${row}${letters[col]}`,
      class: 'ECONOMY' as const,
    });
  }

  await prisma.seat.createMany({ data: seats });

  // Create a second flight with small aircraft for overbooking demo
  const smallAircraft = await prisma.aircraft.create({
    data: {
      model: 'Embraer E175',
      manufacturer: 'Embraer',
      totalSeats: 10,
      economySeats: 8,
      businessSeats: 2,
      firstSeats: 0,
    },
  });

  const smallFlight = await prisma.flight.create({
    data: {
      flightNumber: 'AA999',
      aircraftId: smallAircraft.id,
      departureAirportId: jfk.id,
      arrivalAirportId: lhr.id,
      departureTime: addHours(departureTime, 2),
      arrivalTime: addHours(departureTime, 9),
      basePrice: 599.99,
    },
  });

  const smallSeats = [];
  for (let i = 1; i <= 2; i++) {
    smallSeats.push({
      flightId: smallFlight.id,
      seatNumber: `1${String(i).padStart(2, '0')}`,
      class: 'BUSINESS' as const,
    });
  }
  for (let i = 1; i <= 8; i++) {
    smallSeats.push({
      flightId: smallFlight.id,
      seatNumber: `2${String(i).padStart(2, '0')}`,
      class: 'ECONOMY' as const,
    });
  }
  await prisma.seat.createMany({ data: smallSeats });

  console.log('Seed data created successfully');
  console.log('Flights: AA101 (150 seats), AA999 (10 seats)');
  console.log('Airports: JFK, LAX, LHR');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
