# Architecture Guide

## System Components

### API Layer (Express 5)

The REST API handles HTTP requests and responses. Uses middleware for:
- Authentication (JWT)
- Validation (express-validator)
- Error handling
- Logging (morgan)

### Service Layer

Business logic is encapsulated in services:
- `RestaurantService` - Restaurant and menu management
- `OrderService` - Order lifecycle and assignment
- `DriverService` - Driver management and availability
- `TrackingService` - Location tracking and ETA calculation

### Data Access Layer (Prisma)

Prisma ORM provides type-safe database access:
- Auto-generated client from schema
- Connection pooling
- Query optimization
- Migration management

### Real-time Layer (Socket.IO)

WebSocket connections for:
- Live driver location updates
- Order status changes
- ETA updates

## Order Assignment Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Customer │────▶│  Order   │────▶│  Find    │────▶│ Assign   │
│ Places   │     │ Created  │     │ Driver   │     │ Driver   │
│ Order    │     │ (PLACED) │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                          │
                    ┌──────────┐     ┌──────────┐        │
                    │ Driver   │◀────│ Driver   │◀───────┘
                    │ Notified │     │ Accepts  │
                    │          │     │ Order    │
                    └──────────┘     └──────────┘
```

## ETA Calculation

1. Get latest driver location from tracking table
2. Calculate distance to destination using Haversine formula
3. Assume average speed: 30 km/h urban, 50 km/h highway
4. Add preparation time estimate from restaurant

## Scalability Considerations

- **Read Replicas**: For restaurant/menu listings
- **Caching**: Redis for popular restaurants
- **Queue**: Message queue for order processing
- **Partitioning**: Partition orders by date
