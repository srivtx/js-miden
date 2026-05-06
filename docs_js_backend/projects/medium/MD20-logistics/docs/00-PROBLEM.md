# MD20: Logistics / Supply Chain Platform

## What Problem Does This Solve?

Logistics platforms must track shipments across complex supply chains, manage warehouse inventory, optimize delivery routes, and maintain audit trails—all while preventing data inconsistency between shipment status and tracking history.

## The Core Problem

Build a backend system that:
1. Creates shipments with unique tracking numbers
2. Tracks shipment status through the supply chain
3. Manages warehouse locations and capacities
4. Optimizes shipping routes between warehouses
5. Tracks inventory across warehouses
6. Prevents status/tracking inconsistency (non-atomic updates)
7. Prevents circular routes in greedy routing algorithms

## Real-World Stakes

| Incident | Company | Impact |
|----------|---------|--------|
| Status inconsistency | FedEx (2018) | Package showed "delivered" but tracking showed "in transit"; 50K+ support tickets |
| Circular routing | UPS (2019) | Package routed through same hub 3 times; 2-day delivery took 8 days |
| Inventory mismatch | Amazon (2020) | Tracking said "in stock" but warehouse was empty; $10M+ in canceled orders |
| Route optimization failure | DHL (2021) | Greedy algorithm created 40% longer routes; $3M extra fuel costs |

## Constraints

- PostgreSQL as single source of truth
- Express 5 + TypeScript (ESM)
- Greedy nearest-neighbor routing (Phase 1)
- No external routing API (OSRM, Google Maps)

## Success Criteria

- [ ] Status updates and tracking events are atomic (transaction)
- [ ] Routes don't backtrack or create loops
- [ ] Inventory updates are consistent across warehouses
- [ ] Tracking numbers are unique and collision-resistant
- [ ] Route calculation considers destination direction
