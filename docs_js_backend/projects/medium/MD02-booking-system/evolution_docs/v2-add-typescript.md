# MD02 Booking System — v2 Adding TypeScript

## The Bug

You just debugged why a booking for "2025-06-01" was stored but never shows up in search.

```js
app.post('/book', (req, res) => {
  const { room, date, user } = req.body;
  bookings.push({ room, date, user });
});
```

A client sent:
```json
{ "room": "A", "date": "06/01/2025", "user": "alice" }
```

Another sent:
```json
{ "date": "2025-06-01T10:00:00.000Z", "room": "A" }
```

Your search does string comparison. `"06/01/2025"` ≠ `"2025-06-01T10:00:00.000Z"`. The calendar is chaos.

TypeScript would have forced you to pick a single representation.

## The Fix: Types First

```ts
// types.ts
export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface Booking {
  id: string;
  roomId: string;
  slot: TimeSlot;
  userId: string;
  status: 'confirmed' | 'hold' | 'cancelled';
  createdAt: Date;
  expiresAt?: Date; // for holds
}

export interface CreateBookingRequest {
  roomId: string;
  start: Date;
  durationMinutes: number;
  userId: string;
}
```

Now `start` is always a `Date`. No more string formats. No more ambiguity.

## Modeling the Calendar

```ts
// calendar.ts
export interface Room {
  id: string;
  name: string;
  openHour: number; // 0-23
  closeHour: number;
}

export interface CalendarDay {
  roomId: string;
  date: Date;
  slots: TimeSlot[];
}

export function generateSlots(
  room: Room,
  date: Date,
  slotMinutes: number = 30
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const start = new Date(date);
  start.setHours(room.openHour, 0, 0, 0);
  const end = new Date(date);
  end.setHours(room.closeHour, 0, 0, 0);

  for (let t = start; t < end; t.setMinutes(t.getMinutes() + slotMinutes)) {
    const slotEnd = new Date(t);
    slotEnd.setMinutes(slotEnd.getMinutes() + slotMinutes);
    slots.push({ start: new Date(t), end: slotEnd });
  }
  return slots;
}
```

## The Booking Service Interface

```ts
// bookingService.ts
export interface IBookingService {
  getAvailability(roomId: string, date: Date): Promise<TimeSlot[]>;
  createBooking(req: CreateBookingRequest): Promise<Booking>;
  createHold(roomId: string, slot: TimeSlot, userId: string, ttlMinutes: number): Promise<Booking>;
  confirmHold(bookingId: string): Promise<Booking>;
  cancelBooking(bookingId: string): Promise<void>;
}
```

This forces us to think about holds before implementing them. It also makes the overlap logic testable in isolation.

## Why This Matters

Date handling is one of the most bug-prone areas in booking systems. TypeScript forces consistency:
- No mixed string/date types
- No missing status fields
- No accidental mutation of shared Date objects

**Next:** Let's add validation so users can't book Room A from 2 PM to 1 PM.
