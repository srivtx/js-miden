# Design Decisions

## Decision 1: Seat-Level Booking Model

**Rationale**: Each booking is tied to a specific seat, not just a class. This enables seat maps and passenger preference (window, aisle).

**Trade-off**: More complex than a simple counter, but necessary for airline domain.

## Decision 2: Separate Seat Table

**Rationale**: Individual seat records allow blocking specific seats (maintenance, crew rest) and tracking seat-specific bookings.

**Trade-off**: More joins in queries, but enables rich seat map functionality.

## Decision 3: No Overbooking Engine

**Rationale**: Unlike real airlines, our system should prevent ALL overbooking to make the bug clear.

**Real-world note**: Production systems often allow controlled overbooking with compensation workflows.

## Decision 4: Class-Based Baggage Rules

**Rationale**: Different classes have different allowances:
- Economy: 1 bag, 23kg
- Business: 2 bags, 28kg each
- First: 3 bags, 32kg each

## Decision 5: Boarding Pass Generation

**Rationale**: Simple string code generation rather than actual QR codes. Keeps the project focused on backend logic.

## Decision 6: Flight Status Enum

**Rationale**: Standard airline statuses (SCHEDULED, BOARDING, DEPARTED, etc.) modeled as enum for type safety.
