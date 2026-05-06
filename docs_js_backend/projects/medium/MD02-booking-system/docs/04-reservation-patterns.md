# MD02: Reservation Patterns — Hold Before Pay

## The User Journey

A booking system must handle the gap between user intent and payment completion:

```
User selects slot
       │
       ▼
[Check Availability] ──NO──► [Show "Unavailable"]
       │
      YES
       │
       ▼
[Create HOLD] ──► [Redirect to Payment] ──► [Payment Success] ──► [CONFIRM]
       │                                        │
       │                                        ▼
       │                                   [Payment Fail]
       │                                        │
       │                                        ▼
       │<─────────────────────────────── [Release Hold]
       │
       ▼
[HOLD expires after N min]
       │
       ▼
[Release slot]
```

This pattern is used by **Airbnb**, **Eventbrite**, **Ticketmaster**, and virtually every reservation system.

## Why Hold Before Pay?

1. **User Experience**: The user needs certainty that the slot is theirs while they enter payment details.
2. **Inventory Protection**: Without a hold, another user could book the slot during payment.
3. **Payment Friction**: Payment takes time (3D Secure, bank redirects, wallet confirmations).

## The Hold State Machine

```
         create hold
[AVAILABLE] ────────────► [HOLD]
                              │
                    ┌─────────┴─────────┐
                    │                   │
              payment success      hold expires
                    │                   │
                    ▼                   ▼
              [CONFIRMED]          [RELEASED]
                    │                   │
              cancel booking            │
                    │                   │
                    ▼                   │
              [CANCELLED] ◄─────────────┘
```

## SQL Implementation

```sql
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL,
    user_id UUID NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) CHECK (status IN ('hold', 'confirmed', 'cancelled')),
    hold_expires_at TIMESTAMPTZ,
    payment_intent_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial index for active bookings (used in overlap checks)
CREATE INDEX idx_bookings_active ON bookings (resource_id, start_time, end_time)
WHERE status IN ('hold', 'confirmed');
```

### Creating a Hold

```sql
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- 1. Verify no overlap
SELECT * FROM bookings
WHERE resource_id = 'room-101'
  AND status IN ('hold', 'confirmed')
  AND start_time < '2024-07-01T12:00:00Z'
  AND end_time > '2024-07-01T10:00:00Z'
FOR UPDATE;

-- 2. If no rows, insert hold
INSERT INTO bookings (
    resource_id, user_id, start_time, end_time,
    status, hold_expires_at
) VALUES (
    'room-101', 'user-123',
    '2024-07-01T10:00:00Z', '2024-07-01T12:00:00Z',
    'hold', NOW() + INTERVAL '15 minutes'
);

COMMIT;
```

### Confirming a Hold (Post-Payment)

```sql
BEGIN;

UPDATE bookings
SET status = 'confirmed',
    hold_expires_at = NULL,
    payment_intent_id = 'pi_abc123'
WHERE id = 'booking-456'
  AND status = 'hold'
  AND hold_expires_at > NOW();

-- Check if update succeeded (rowCount > 0)
-- If 0 rows: hold expired before payment completed

COMMIT;
```

### Releasing Expired Holds

A background worker runs periodically:

```sql
BEGIN;

WITH expired AS (
    SELECT id FROM bookings
    WHERE status = 'hold'
      AND hold_expires_at < NOW()
    FOR UPDATE SKIP LOCKED
    LIMIT 100
)
UPDATE bookings
SET status = 'cancelled'
WHERE id IN (SELECT id FROM expired);

COMMIT;
```

`FOR UPDATE SKIP LOCKED` allows multiple workers to clean up holds in parallel without blocking each other.

## Hold Duration Strategy

| Context | Hold Duration | Rationale |
|---------|--------------|-----------|
| Concert tickets | 5-10 minutes | High demand, scalper prevention |
| Hotel rooms | 15-30 minutes | Payment forms, international cards |
| Restaurant tables | 5 minutes | Walk-in demand, short window |
| Airline seats | 20-30 minutes | Complex fare rules |
| Doctor appointments | 24 hours | Insurance verification may be needed |

Airbnb typically holds for **24 hours** for standard bookings, but this varies by host settings.

## Race Condition: Hold Expiration During Payment

```
Timeline:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Time │ User Action                    │ System Action
─────┼────────────────────────────────┼─────────────────────────────
 T0  │ Clicks "Book"                  │
 T1  │                                │ Creates HOLD (expires T0+15m)
 T2  │ Enters credit card details     │
 T3  │ Clicks "Pay"                   │
 T4  │                                │ Payment gateway processing...
 T5  │                                │ HOLD EXPIRES (worker runs)
 T6  │                                │ Payment gateway returns SUCCESS
 T7  │                                │ Tries to CONFIRM hold → FAILS
─────┴────────────────────────────────┴─────────────────────────────
Result: User was charged, but hold expired. Slot may be taken.
```

**Solution**: Do NOT let holds expire while payment is in-flight.
1. Extend hold expiration before calling the payment gateway.
2. If payment succeeds but confirmation fails, trigger a **refund** or **re-hold** workflow.
3. Use a **state machine** with an `confirming` status:

```sql
ALTER TABLE bookings ADD CONSTRAINT status_check
CHECK (status IN ('hold', 'confirming', 'confirmed', 'cancelled'));

-- Before payment:
UPDATE bookings SET status = 'confirming' WHERE id = 'booking-456';
-- This extends the effective hold during payment processing.
```

## Payment Intent Pattern (Stripe-Style)

```javascript
// 1. Create hold
const hold = await createHold(resourceId, start, end);

// 2. Create PaymentIntent (holds funds, doesn't charge)
const paymentIntent = await stripe.paymentIntents.create({
    amount: 10000,
    currency: 'usd',
    capture_method: 'manual', // Authorize only
    metadata: { bookingId: hold.id }
});

// 3. Client confirms payment (3D Secure, etc.)

// 4. Webhook: payment_intent.succeeded
app.post('/webhook', (req, res) => {
    if (req.body.type === 'payment_intent.succeeded') {
        const bookingId = req.body.data.object.metadata.bookingId;
        confirmBooking(bookingId); // UPDATE status to 'confirmed'
    }
});
```

## Key Insight

> "A hold is a soft lock with a timeout. It is the mechanism by which a booking system bridges the asynchronous gap between user decision and payment completion." — Booking System Design Patterns

The hold pattern is the primary reason booking systems cannot be simple CRUD apps. It introduces time, state, and concurrency in ways that require careful transaction design.
