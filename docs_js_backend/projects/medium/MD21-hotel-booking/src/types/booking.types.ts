import { z } from 'zod';

export const createBookingSchema = z.object({
  roomId: z.string().min(1),
  guestEmail: z.string().email(),
  guestName: z.string().min(1),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
