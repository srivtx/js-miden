# Architecture Guide

## System Components

### API Layer (Express 5)

REST API with middleware for authentication, validation, error handling, and logging.

### Service Layer

- `ListingService` - Property listing CRUD
- `SearchService` - Property search and filtering
- `TourService` - Tour booking management
- `AgentService` - Agent matching and management
- `CalculatorService` - Mortgage calculations

### Data Access Layer (Prisma)

Type-safe database access with connection pooling.

## Search Architecture

### Current Implementation
1. Parse query parameters
2. Build Prisma where clause
3. Execute query with filters
4. Return results

### Performance Issues
- LIKE queries on address are slow
- No geospatial indexing for nearby search
- Application-level distance filtering

## Mortgage Calculator

Simple amortization calculation:
- Monthly payment formula
- Total interest over loan term
- Principal vs interest breakdown

## Scalability Considerations

- **Elasticsearch**: For full-text search
- **PostGIS**: For geospatial queries
- **Caching**: Popular searches
- **CDN**: Property images
