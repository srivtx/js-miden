# Database Schema

## Entity Relationship Diagram

```
┌─────────┐     ┌──────────┐     ┌──────────┐
│  User   │────▶│  Rider   │────▶│  Ride    │
└─────────┘     └──────────┘     └──────────┘
     │                                  │
     │         ┌──────────┐            │
     └────────▶│  Driver  │◀───────────┘
               └──────────┘
                    │
                    ▼
               ┌─────────┐
               │ Review  │
               └─────────┘
```

## Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| email | String | Unique |
| password | String | |
| name | String | |
| phone | String | Nullable |
| role | Enum | RIDER, DRIVER, ADMIN |

### riders
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users, Unique |

### drivers
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users, Unique |
| is_available | Boolean | Default true |
| latitude | Float | Nullable |
| longitude | Float | Nullable |
| vehicle_type | String | |
| license_plate | String | |
| rating | Float | Default 5.0 |

### rides
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| rider_id | UUID | FK → riders |
| driver_id | UUID | FK → drivers, Nullable |
| status | Enum | REQUESTED, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED |
| pickup_address | String | |
| pickup_lat | Float | |
| pickup_lng | Float | |
| dropoff_address | String | |
| dropoff_lat | Float | |
| dropoff_lng | Float | |
| base_fare | Decimal(10,2) | |
| distance_fare | Decimal(10,2) | |
| time_fare | Decimal(10,2) | |
| surge_multiplier | Decimal(3,2) | Default 1.00 |
| total_fare | Decimal(10,2) | |
| distance_km | Float | |
| estimated_minutes | Int | |
| actual_minutes | Int | Nullable |

### reviews
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| ride_id | UUID | FK → rides, Unique |
| reviewer_id | UUID | FK → users |
| rating | Int | |
| comment | String | Nullable |

### surge_pricing
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| zone_lat | Float | |
| zone_lng | Float | |
| zone_radius | Float | |
| multiplier | Decimal(3,2) | |
| demand | Int | Default 0 |
| supply | Int | Default 0 |
| active | Boolean | Default true |

## Indexes

- `rides_rider_id_idx` on rides(rider_id)
- `rides_driver_id_idx` on rides(driver_id)
- `rides_status_idx` on rides(status)
- `drivers_available_idx` on drivers(is_available)
