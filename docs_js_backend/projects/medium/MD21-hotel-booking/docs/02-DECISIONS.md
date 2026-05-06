# Design Decisions

## Decision 1: Use Advisory Locks for Booking

**Rationale**: Advisory locks in PostgreSQL provide application-level locking without blocking table reads. We lock a resource identifier derived from `roomId + dateRange` during the entire check-and-book operation.

**Alternative considered**: Row-level locks (SELECT FOR UPDATE) on room table, but this blocks room reads and doesn't handle date-range overlaps well.

## Decision 2: Store Pricing Tiers Separately

**Rationale**: Separating pricing tiers from room types allows flexible seasonal pricing without duplicating room type data.

**Trade-off**: More complex price calculation (must iterate nights and check applicable tiers).

## Decision 3: Soft Deletes for Bookings

**Rationale**: Instead of deleting cancelled bookings, we update status to `CANCELLED`. This preserves booking history and supports analytics.

**Trade-off**: Queries must filter by status, slightly more complex.

## Decision 4: Reservation Holds Table

**Rationale**: Dedicated table for temporary holds with `heldUntil` timestamp. A cron job or background worker cleans expired holds.

**Trade-off**: Additional table to maintain, but clear separation of concerns.

## Decision 5: Decimal for Monetary Values

**Rationale**: Using PostgreSQL `Decimal` type prevents floating-point precision errors in financial calculations.

**Trade-off**: Must convert to/from number in JavaScript.

## Decision 6: ESM Modules

**Rationale**: Modern JavaScript standard, better tree-shaking, aligned with Express 5.

**Trade-off**: Need `.js` extensions in imports, some tooling still assumes CommonJS.
