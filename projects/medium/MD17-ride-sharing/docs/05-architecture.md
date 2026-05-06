# Architecture Guide

## System Components

### API Layer (Express 5)

REST API handling HTTP requests with middleware for:
- Authentication (JWT)
- Validation
- Error handling
- Logging

### Service Layer

Business logic in services:
- `RideService` - Ride requests, acceptance, completion, fare calculation
- `DriverService` - Driver availability and location management
- `RiderService` - Rider profile and ride history
- `ReviewService` - Rating and review management

### Data Access Layer (Prisma)

Type-safe database access with:
- Auto-generated client
- Connection pooling
- Query optimization

## Ride Matching Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Rider   │────▶│  Request │────▶│  Find    │
│ Request  │     │  Ride    │     │  Drivers │
└──────────┘     └──────────┘     └──────────┘
                                         │
                    ┌──────────┐        │
                    │  Driver  │◀───────┘
                    │  Accepts │
                    └──────────┘
```

## Fare Calculation Algorithm

1. Calculate distance using Haversine formula
2. Estimate time based on distance and average speed
3. Query current demand/supply in zone
4. Calculate surge multiplier
5. Compute total fare

## Surge Pricing

Dynamic pricing based on demand/supply ratio:
- Ratio > 2.0: 2.5x multiplier
- Ratio > 1.5: 2.0x multiplier
- Ratio > 1.0: 1.5x multiplier
- Otherwise: 1.0x (normal)

## Scalability Considerations

- **Geospatial Indexing**: PostGIS for efficient location queries
- **Caching**: Redis for driver locations
- **Queue**: Message queue for ride matching
- **WebSocket**: Horizontal scaling with Redis adapter
