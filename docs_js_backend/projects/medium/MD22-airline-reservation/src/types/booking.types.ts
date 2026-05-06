import { z } from 'zod';

export const createBookingSchema = z.object({
  flightId: z.string().min(1),
  seatId: z.string().min(1),
  passengerName: z.string().min(1),
  passengerEmail: z.string().email(),
  bookingClass: z.enum(['ECONOMY', 'BUSINESS', 'FIRST']),
  baggageCount: z.number().min(0).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
