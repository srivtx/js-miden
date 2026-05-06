# MD02: Real-World Examples and Case Studies

## Airbnb: The Hold-Before-Pay Pioneer

Airbnb's booking flow is the canonical example of the hold-before-pay pattern.

### Booking Flow
1. **Search**: User searches for dates/location.
2. **Instant Book or Request**: Hosts can enable "Instant Book" (auto-confirm) or require approval.
3. **Pre-Approval Hold**: For Instant Book, Airbnb creates a hold while payment is processed.
4. **Payment**: User enters payment details; Stripe handles 3D Secure.
5. **Confirmation**: On success, hold converts to confirmed booking.

### Key Technical Decisions
- **Calendar Sync**: Hosts can sync Airbnb calendars with other platforms (VRBO, Booking.com) via iCal feeds. This introduces eventual consistency — a booking on VRBO may not immediately block Airbnb.
- **Exclusion Strategy**: Airbnb likely uses database-level constraints for a single listing, but cross-platform sync relies on periodic iCal polling.
- **Cancellation**: Hosts set policies (Flexible, Moderate, Strict). The refund engine must handle currency conversion, host penalties, and service fee refunds.

## Google Calendar: The Reference Implementation

Google Calendar's API is the gold standard for temporal data handling.

### Key Features
1. **Timezone-Aware Recurrence**: Events repeat in local time, adjusting for DST automatically.
2. **Free/Busy Queries**: The `freebusy.query` endpoint returns available slots without exposing event details (privacy-preserving).
3. **Conflict Detection**: `conferenceData` and `outOfOffice` events participate in overlap checks.

### API Pattern for Availability
```http
POST https://www.googleapis.com/calendar/v3/freeBusy
{
  "timeMin": "2024-06-01T00:00:00Z",
  "timeMax": "2024-06-02T00:00:00Z",
  "items": [{"id": "room-101@company.com"}]
}
```

Response:
```json
{
  "calendars": {
    "room-101@company.com": {
      "busy": [
        {"start": "2024-06-01T10:00:00Z", "end": "2024-06-01T12:00:00Z"}
      ]
    }
  }
}
```

This is the model for our system's availability endpoint.

## OpenTable: Restaurant Reservations

OpenTable handles unique constraints:
- **Table turnover**: A table might be bookable at 6:00 PM and 8:30 PM, but not 7:00 PM (insufficient time between seatings).
- **Party size**: A 6-person party cannot fit at a 4-top table, even if the time slot is free.
- **Turn time**: Each reservation has a "turn time" (e.g., 90 minutes for dinner). The next booking can only start after `end_time + buffer`.

```sql
-- Check with turn buffer
SELECT * FROM bookings
WHERE resource_id = 'table-5'
  AND status IN ('confirmed', 'hold')
  AND start_time < '2024-06-01T20:00:00Z'::timestamptz + INTERVAL '30 minutes'
  AND end_time > '2024-06-01T18:00:00Z'::timestamptz - INTERVAL '30 minutes';
```

## Ticketmaster: High-Volume Flash Sales

Ticketmaster sells out stadiums in minutes. Their challenges:
1. **Massive Contention**: 100,000 users trying for 20,000 seats.
2. **Seat Selection**: Users pick specific seats, not just time ranges.
3. **Queue System**: Users enter a virtual queue to prevent DB overload.

### Queue Pattern
```
User requests tickets
        │
        ▼
[Queue Service] assigns position
        │
        ▼
[Polling endpoint] tells user their position
        │
        ▼
[When position = 0] redirect to seat selection
```

This decouples the high-traffic announcement from the actual booking database.

## Calendly: Recurrence and Buffer

Calendly's booking system adds:
- **Before/After Buffers**: "Don't book meetings back-to-back; leave 15 minutes."
- **Round-Robin**: Assign meetings to team members based on availability.
- **Minimum Notice**: "Don't allow bookings less than 24 hours in advance."

```sql
-- Minimum notice rule
IF requested_start < NOW() + INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Booking must be at least 24 hours in advance';
END IF;
```

## Comparison Matrix

| Platform | Overlap Enforcement | Hold Duration | Timezone Handling | Recurrence |
|----------|---------------------|---------------|-------------------|------------|
| Airbnb | DB constraints + iCal sync | 24-48h | Resource timezone | No |
| Google Calendar | Internal (Bigtable?) | N/A | Full IANA support | Full RRULE |
| OpenTable | DB constraints | 5-15 min | Restaurant local | No |
| Ticketmaster | Distributed locks | 10 min | Event local | No |
| Calendly | DB constraints | N/A (instant) | User timezone | Weekly rules |

## Lessons for This Project

1. **Adopt Exclusion Constraints**: They are the simplest way to guarantee no double-bookings.
2. **Implement Holds**: Even for "instant" bookings, a brief hold during payment prevents race conditions.
3. **Support IANA Timezones**: Use `moment-timezone` or `Luxon` in the application layer.
4. **Build a Free/Busy Endpoint**: This is the most common query pattern.
5. **Plan for Cross-Platform Sync**: Even if not needed now, design the calendar export (iCal) format from day one.
