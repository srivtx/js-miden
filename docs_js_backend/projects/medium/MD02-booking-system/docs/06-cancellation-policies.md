# MD02: Cancellation Policies

## Why Cancellation Policies Matter

Cancellation policies balance **user flexibility** with **business protection**. A hotel cannot afford to have rooms cancelled at the last minute with no penalty. Conversely, a rigid no-refund policy drives users to competitors.

## Policy Spectrum

| Policy Type | Refund | Typical Use Case |
|-------------|--------|-----------------|
| **Flexible** | Full refund up to 24h before | Co-working desks, yoga classes |
| **Moderate** | 50% refund 7 days before, 0% within 7 days | Boutique hotels |
| **Strict** | 0% refund after booking | Concert tickets, flight deals |
| **Custom** | Host-defined rules | Airbnb |

## Data Model

```sql
CREATE TABLE cancellation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID REFERENCES resources(id),
    name VARCHAR(100) NOT NULL,
    rules JSONB NOT NULL,
    -- Example rules:
    -- [
    --   { "hours_before": 168, "refund_percent": 100 },
    --   { "hours_before": 24,  "refund_percent": 50 },
    --   { "hours_before": 0,   "refund_percent": 0 }
    -- ]
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bookings (
    id UUID PRIMARY KEY,
    ...,
    cancellation_policy_id UUID REFERENCES cancellation_policies(id),
    total_cents INT NOT NULL,
    refunded_cents INT DEFAULT 0
);
```

## Calculating Refund Amount

```sql
CREATE OR REPLACE FUNCTION calculate_refund(
    p_booking_id UUID,
    p_cancel_time TIMESTAMPTZ
) RETURNS INT AS $$
DECLARE
    v_booking bookings%ROWTYPE;
    v_policy JSONB;
    v_hours_before INT;
    v_refund_percent INT;
    v_rule JSONB;
BEGIN
    SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
    SELECT rules INTO v_policy
    FROM cancellation_policies
    WHERE id = v_booking.cancellation_policy_id;

    v_hours_before := EXTRACT(EPOCH FROM (v_booking.start_time - p_cancel_time)) / 3600;

    -- Find the most generous applicable rule
    v_refund_percent := 0;
    FOR v_rule IN SELECT * FROM jsonb_array_elements(v_policy) LOOP
        IF v_hours_before >= (v_rule->>'hours_before')::INT
           AND (v_rule->>'refund_percent')::INT > v_refund_percent THEN
            v_refund_percent := (v_rule->>'refund_percent')::INT;
        END IF;
    END LOOP;

    RETURN (v_booking.total_cents * v_refund_percent) / 100;
END;
$$ LANGUAGE plpgsql;
```

## Cancellation Transaction

```sql
BEGIN ISOLATION LEVEL READ COMMITTED;

-- 1. Lock the booking
SELECT * FROM bookings WHERE id = 'booking-123' FOR UPDATE;

-- 2. Verify it can be cancelled
IF status NOT IN ('confirmed', 'hold') THEN
    ROLLBACK;
    RAISE EXCEPTION 'Booking cannot be cancelled';
END IF;

-- 3. Calculate refund
SELECT calculate_refund('booking-123', NOW()) INTO refund_amount;

-- 4. Update booking
UPDATE bookings
SET status = 'cancelled',
    refunded_cents = refund_amount,
    updated_at = NOW()
WHERE id = 'booking-123';

-- 5. Release resource (remove from active bookings)
-- The overlap query automatically excludes 'cancelled' via partial index

-- 6. Process refund (async via message queue)
INSERT INTO refund_queue (booking_id, amount_cents, status)
VALUES ('booking-123', refund_amount, 'pending');

COMMIT;
```

## Airbnb-Style Policy Tiers

Airbnb offers hosts preset policies:

| Policy | Full Refund Until | 50% Refund Until |
|--------|-------------------|------------------|
| Flexible | 24 hours before | N/A |
| Moderate | 5 days before | 24 hours before |
| Strict | 48 hours after booking OR 14 days before | 7 days before |
| Non-refundable | Never | Never (but 10% cheaper price) |

Implementing "48 hours after booking OR 14 days before" requires dual conditions:

```sql
-- Pseudo-logic
IF (NOW() < booking.created_at + INTERVAL '48 hours')
   OR (NOW() < booking.start_time - INTERVAL '14 days') THEN
    refund_percent := 100;
ELSIF (NOW() < booking.start_time - INTERVAL '7 days') THEN
    refund_percent := 50;
ELSE
    refund_percent := 0;
END IF;
```

## Partial Cancellations

For multi-day bookings or multi-seat bookings, users may cancel only part:

```sql
-- Original: 3 nights, $300 total
-- User cancels night 2

-- Option 1: Split booking
-- Original booking: nights 1,3 ($200)
-- New cancelled booking: night 2 ($100, refunded)

-- Option 2: Adjustment record
CREATE TABLE booking_adjustments (
    id UUID PRIMARY KEY,
    booking_id UUID REFERENCES bookings(id),
    adjustment_type VARCHAR(20), -- 'cancellation', 'modification'
    original_start TIMESTAMPTZ,
    original_end TIMESTAMPTZ,
    new_start TIMESTAMPTZ,
    new_end TIMESTAMPTZ,
    refund_cents INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## No-Show Policy

What if the user doesn't cancel but also doesn't show up?

```sql
-- Run after event start time
UPDATE bookings
SET status = 'no_show'
WHERE status = 'confirmed'
  AND start_time < NOW()
  AND end_time > NOW()  -- still within the window
  AND checked_in_at IS NULL;

-- No-shows typically receive 0% refund regardless of policy
```

## Timeline: Cancellation Race Condition

```
User clicks "Cancel" in two browser tabs simultaneously.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Time │ Tab 1                        │ Tab 2
─────┼──────────────────────────────┼──────────────────────────────
 T0  │ BEGIN; SELECT ... FOR UPDATE │
 T1  │ (locks booking)              │ BEGIN; SELECT ... FOR UPDATE
 T2  │                              │ (WAITS)
 T3  │ UPDATE status='cancelled'    │
 T4  │ COMMIT                       │
 T5  │                              │ SELECT returns status='cancelled'
 T6  │                              │ Application detects already cancelled
 T7  │                              │ ROLLBACK
─────┴──────────────────────────────┴──────────────────────────────
Result: Only one cancellation processed. No double-refund.
```

## Key Insight

> "Cancellation is not an undo. It is a business event with financial and inventory consequences that must be auditable." — Revenue Recognition Principles

Every cancellation generates:
1. A refund transaction (financial record)
2. An inventory release (availability change)
3. A notification (email to user and resource owner)
4. An audit log (who cancelled, when, why)

These must be atomic where possible (database transaction) and eventually consistent where not (email sending).
