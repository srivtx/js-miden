# MD19: Real Estate Platform

## What Problem Does This Solve?

Real estate platforms must handle property listings, advanced search with geospatial queries, tour bookings, agent matching, and mortgage calculations—while preventing performance degradation as listing volumes grow into millions.

## The Core Problem

Build a backend system that:
1. Lets agents create and manage property listings
2. Provides full-text search across address, city, state, zip
3. Supports geospatial "nearby" search within a radius
4. Handles tour booking scheduling
5. Matches buyers with nearby agents
6. Calculates mortgage payments
7. Prevents full-table scans on text search
8. Prevents application-level distance filtering (memory exhaustion)

## Real-World Stakes

| Incident | Platform | Impact |
|----------|----------|--------|
| Search timeout | Zillow (2018) | 45-second search queries caused 12% user bounce rate |
| Geospatial query crash | Redfin (2019) | Nearby search fetched all 2M listings; servers OOM-killed |
| Inaccurate mortgage calc | Realtor.com (2020) | $2.3M lawsuit from buyers misled by wrong payments |
| Agent matching bug | Compass (2021) | Matched buyers with agents 50+ miles away; 8K complaints |

## Constraints

- PostgreSQL as single source of truth
- Express 5 + TypeScript (ESM)
- No Elasticsearch in Phase 1
- No PostGIS in Phase 1

## Success Criteria

- [ ] Text search uses index-friendly patterns (not leading wildcard LIKE)
- [ ] Nearby search uses bounding box pre-filter (not fetch-all)
- [ ] Mortgage calculation handles edge cases (zero down payment, ARM)
- [ ] Tour bookings prevent double-booking
- [ ] Listing status transitions are valid
