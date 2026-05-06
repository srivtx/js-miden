# MD02: Booking System — Project Overview

## Abstract

This project implements a robust reservation and booking backend capable of handling calendar-based resource allocation. It addresses the core challenge of **time-range exclusivity**: ensuring that no two bookings overlap for the same resource while managing timezone complexity, cancellation policies, and payment holds.

## System Context

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────────┐
│   Client     │────▶│  API Gateway │────▶│  Booking Service    │
│ (Web/Mobile) │◄────│   (Auth,     │◄────│  (Node.js/Fastify)  │
└──────────────┘     │   RateLimit) │     └─────────────────────┘
                     └──────────────┘              │
                                                   ▼
                     ┌──────────────┐     ┌─────────────────────┐
                     │  Notification│◄────│  PostgreSQL (ACID)  │
                     │   Service    │     │  Redis (Locks)      │
                     └──────────────┘     └─────────────────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────────┐
                                          │  Payment Gateway    │
                                          │  (Hold/Charge)      │
                                          └─────────────────────┘
```

## Functional Requirements

1. **Resource Calendar**: Each resource (room, seat, vehicle) has a bookable calendar.
2. **Availability Query**: Users can query open slots given constraints.
3. **Reservation with Hold**: A temporary hold reserves the slot for N minutes before payment.
4. **Booking Confirmation**: Converts a hold to a confirmed booking upon payment.
5. **Cancellation**: Supports full, partial, and no-refund policies.
6. **Recurring Bookings**: Support for weekly/daily repeating patterns.

## Non-Functional Requirements

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Overlap Prevention | 100% | Double-booking is unacceptable |
| Query Latency | < 200ms | Calendar must feel responsive |
| Timezone Accuracy | 100% | 12:00 in Tokyo ≠ 12:00 in NYC |
| Availability | 99.9% | Revenue-critical |

## CAP Theorem Positioning

Booking systems are **CP by necessity**. A partition between two datacenters must not allow double-booking of the same room. This aligns with **Eric Brewer's** original insight that systems requiring strong consistency must sacrifice availability during partitions.

> "Partition tolerance is not really a choice in a distributed system... if you have a partition, you must choose between C and A." — Eric Brewer, 2012 (CAP Twelve Years Later)

## Core Algorithm

The overlap query is the beating heart of this system:

```sql
-- The canonical overlap condition
WHERE new_start < existing_end
  AND new_end > existing_start
```

If this returns any rows, the requested time range conflicts with an existing booking. This will be explored in depth in `03-overlap-algorithms.md`.

## Data Model (Simplified)

```sql
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- 'room', 'desk', 'vehicle'
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC'
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES resources(id),
    user_id UUID REFERENCES users(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) CHECK (status IN ('hold', 'confirmed', 'cancelled')),
    hold_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_overlap ON bookings (resource_id, start_time, end_time)
WHERE status IN ('hold', 'confirmed');
```

## Reference Architecture

This design draws from:
- **Google Calendar API** — for timezone handling and recurrence patterns.
- **Airbnb** — for the "hold before pay" reservation pattern and cancellation policies.
- **Theo Härder & Andreas Reuter (1983)** — ACID foundations for booking transactions.
- **Brewer (2000, 2012)** — CAP theorem and its implications for reservation systems.

## Files in this Documentation

1. `overview.md` — This file
2. `calendar-systems.md` — Calendar data models and recurrence
3. `overlap-algorithms.md` — Time range overlap detection in SQL
4. `reservation-patterns.md` — Hold-before-pay and temporary reservations
5. `timezone-handling.md` — Timezone complexity and edge cases
6. `cancellation-policies.md` — Refund logic and policy enforcement
7. `concurrency-and-locking.md` — Race conditions in booking
8. `real-world-examples.md` — Airbnb, Google Calendar, OpenTable
9. `theory-and-citations.md` — Deeper theory and bibliography
