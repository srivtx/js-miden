# Problem Statement

## Hotel Booking System Race Condition

Build a hotel booking system (Booking.com clone) that handles room inventory, availability calendars, pricing tiers, reservation holds, cancellation policies, and refunds.

## Core Requirements

1. **Room Management**: Hotels have multiple room types and individual rooms
2. **Availability Calendar**: Check room availability for date ranges
3. **Pricing Tiers**: Dynamic pricing (weekend rates, seasonal multipliers)
4. **Reservation Holds**: Soft bookings that expire after a timeout
5. **Cancellation Policies**: Flexible, standard, and strict policies with different refund rules
6. **Overbooking Protection**: Prevent booking more rooms than available

## The Bug

**Race Condition in Availability Check**: Two users can simultaneously book the last available room. The system checks availability in one database query, then creates the booking in a separate query. Between these two operations, another request can sneak in and also pass the availability check, resulting in double-booking the same room for overlapping dates.

## Expected Behavior

When only 1 room is available and 2 users try to book it simultaneously, exactly 1 booking should succeed and the other should fail with "Room unavailable".

## Actual Behavior

Both bookings succeed because the availability check and booking creation are not atomic.

## Impact

- Overbooking leads to guest dissatisfaction
- Hotel staff must manually resolve conflicts
- Revenue loss from compensating overbooked guests
- Reputation damage on review platforms
