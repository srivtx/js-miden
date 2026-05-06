# MD17: Ride Sharing Platform (Uber Clone)

## What Problem Does This Solve?

Ride-sharing platforms must match riders with drivers in real-time, calculate dynamic fares based on supply/demand, track locations, and handle payments—all while preventing race conditions, stale data, and pricing inconsistencies.

## The Core Problem

Build a backend system that:
1. Lets riders request rides with pickup/dropoff locations
2. Matches available drivers to ride requests
3. Calculates dynamic fares with surge pricing
4. Tracks driver location in real-time
5. Handles ride completion and ratings
6. Prevents non-atomic surge pricing calculations
7. Rejects stale location updates

## Real-World Stakes

| Incident | Company | Impact |
|----------|---------|--------|
| Surge pricing bug | Uber (2014) | $10M+ in undercharged rides during New Year's Eve |
| Stale driver locations | Lyft (2017) | Riders waited 15+ min for "nearby" drivers who were miles away |
| Race condition in ride acceptance | Didi (2018) | Multiple drivers accepted same ride; safety incident reports |
| Pricing algorithm error | Uber (2019) | $3M refund due to incorrect surge multiplier in London |

## Constraints

- PostgreSQL as single source of truth
- Express 5 + TypeScript (ESM)
- Haversine formula for distance (Phase 1)
- No external mapping API

## Success Criteria

- [ ] Surge pricing is calculated atomically (consistent demand/supply read)
- [ ] Driver location updates include timestamp validation
- [ ] Ride acceptance prevents double-assignment
- [ ] Fare calculation is deterministic and fair
- [ ] Rating system prevents duplicate reviews
