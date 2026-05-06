# Problem Statement

## Airline Reservation System Overbooking

Build an airline reservation system with flight search, seat maps, booking classes, baggage rules, check-in, and boarding passes.

## Core Requirements

1. **Flight Search**: Search by origin, destination, date; support multi-city and flexible dates
2. **Seat Maps**: Interactive seat selection with real-time availability
3. **Booking Classes**: Economy, Business, First with different pricing and baggage allowances
4. **Baggage Rules**: Weight limits, extra baggage fees, carry-on restrictions
5. **Check-in**: Online check-in within 24 hours of departure
6. **Boarding Passes**: Generate with QR code stub, seat number, gate info
7. **Flight Status**: Real-time updates (delayed, cancelled, boarding)

## The Bug

**Overbooking Not Prevented**: The system sells more tickets than the aircraft has seats. The `createBooking` method checks if a specific seat is available, but doesn't verify the total number of bookings against the aircraft's total capacity. Furthermore, even if it did check capacity, concurrent requests could bypass the check due to a race condition.

## Expected Behavior

When an aircraft has 150 seats, the system must never allow more than 150 confirmed bookings.

## Actual Behavior

The system only checks if the requested seat is already booked. It doesn't enforce a global capacity limit. In concurrent scenarios, two requests could book the same seat or exceed total capacity.

## Impact

- Airlines must compensate bumped passengers (up to 4x ticket price under EU261)
- Operational chaos at gate
- Regulatory fines
- Extreme customer dissatisfaction
