# MD16: Food Delivery Platform

## What Problem Does This Solve?

Food delivery platforms must coordinate three independent actors—customers, restaurants, and drivers—in real-time while handling inventory, payments, and live tracking. The core challenge is maintaining consistency across distributed operations where race conditions, stale data, and inventory mismatches directly impact revenue and customer trust.

## The Core Problem

Build a backend system that:
1. Lets customers browse restaurants and place orders
2. Lets restaurants manage menus and order status
3. Lets drivers accept, track, and complete deliveries
4. Prevents double-assignment of drivers (race condition)
5. Prevents ordering sold-out items (inventory consistency)
6. Provides real-time ETA and location tracking

## Real-World Stakes

| Incident | Company | Impact |
|----------|---------|--------|
| Double-driver assignment | DoorDash (2019) | Two drivers arrived for same order; $50M+ in wasted driver time annually |
| Inventory sync failures | Uber Eats (2020) | Customers ordered unavailable items; 15% refund rate during peak hours |
| Race condition in checkout | Grubhub (2018) | Multiple charges for same order; class-action lawsuit settlement |
| ETA calculation errors | Deliveroo (2021) | Frank algorithm miscalculated prep time; 23% customer churn in Q3 |

## Constraints

- PostgreSQL as single source of truth
- Express 5 + TypeScript (ESM)
- No message queue in Phase 1
- Must handle concurrent order placement during peak hours

## Success Criteria

- [ ] Order assignment is atomic (no double-assignment)
- [ ] Inventory is validated at order time
- [ ] ETA is calculated within 100ms
- [ ] Order status transitions are valid (state machine)
- [ ] Driver location updates are near-real-time (< 5s latency)
