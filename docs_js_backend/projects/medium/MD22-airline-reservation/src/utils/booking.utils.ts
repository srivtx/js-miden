import { BookingStatus, SeatClass } from '@prisma/client';

interface BookingInfo {
  id: string;
  passengerName: string;
  seat: { seatNumber: string };
  flight: {
    flightNumber: string;
    departureTime: Date;
    departureAirport: { code: string };
    arrivalAirport: { code: string };
  };
}

export function generateBoardingPassCode(booking: BookingInfo): string {
  const prefix = booking.flight.flightNumber.replace(/[^A-Z]/g, '');
  const flightNum = booking.flight.flightNumber.replace(/[^0-9]/g, '');
  const seatCode = booking.seat.seatNumber;
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `${prefix}${flightNum}-${seatCode}-${random}`;
}

export function getClassMultiplier(classType: SeatClass): number {
  switch (classType) {
    case 'FIRST':
      return 3;
    case 'BUSINESS':
      return 2;
    case 'ECONOMY':
    default:
      return 1;
  }
}
