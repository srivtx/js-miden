# Architecture Guide

## System Components

### API Layer (Express 5)

REST API with middleware for authentication, validation, error handling, and logging.

### Service Layer

- `ShipmentService` - Shipment lifecycle management
- `TrackingService` - Tracking event management
- `WarehouseService` - Warehouse CRUD operations
- `RouteService` - Route calculation and optimization
- `InventoryService` - Inventory management

### Data Access Layer (Prisma)

Type-safe database access with connection pooling.

## Shipment Lifecycle

```
┌─────────┐     ┌──────────┐     ┌──────────┐
│ CREATED │────▶│PICKED_UP │────▶│IN_TRANSIT│
└─────────┘     └──────────┘     └──────────┘
                                        │
                    ┌──────────┐        │
                    │DELIVERED │◀───────┤
                    └──────────┘        │
                              └─────────┘
                    ┌──────────┐
                    │AT_WAREHOUSE│
                    └──────────┘
```

## Route Calculation

Current implementation uses greedy nearest-neighbor algorithm:
1. Start at origin warehouse
2. Find nearest unvisited warehouse
3. Repeat until close to destination
4. Add destination

### Issues
- Can create circular routes
- Doesn't consider overall route efficiency
- May route away from destination

## Scalability Considerations

- **Message Queue**: For async tracking updates
- **Event Sourcing**: For shipment history
- **Read Replicas**: For tracking queries
- **Caching**: For frequently tracked shipments
