# Database Schema

## Entity Relationship Diagram

```
┌─────────┐     ┌──────────┐     ┌──────────┐
│  User   │────▶│ Shipment │◀────│ Tracking │
└─────────┘     └──────────┘     └──────────┘
     │                │
     │                ▼
     │           ┌──────────┐
     └──────────▶│ Warehouse│
                 └──────────┘
                      │
                      ▼
                 ┌──────────┐
                 │Inventory │
                 └──────────┘
                      │
                      ▼
                 ┌──────────┐
                 │  Route   │
                 └──────────┘
                      │
                      ▼
                 ┌──────────┐
                 │RouteNode │
                 └──────────┘
```

## Tables

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| email | String | Unique |
| password | String | |
| name | String | |
| role | Enum | ADMIN, OPERATOR, DRIVER, WAREHOUSE_MANAGER |

### warehouses
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | String | |
| address | String | |
| city | String | |
| country | String | |
| latitude | Float | |
| longitude | Float | |
| capacity | Int | Default 1000 |

### inventory
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| warehouse_id | UUID | FK → warehouses |
| sku | String | |
| quantity | Int | Default 0 |

### shipments
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| tracking_number | String | Unique |
| status | Enum | CREATED, PICKED_UP, IN_TRANSIT, AT_WAREHOUSE, OUT_FOR_DELIVERY, DELIVERED, EXCEPTION |
| origin_id | UUID | FK → warehouses |
| destination_id | UUID | FK → warehouses |
| weight | Float | |
| created_by | UUID | FK → users |
| delivered_at | Timestamp | Nullable |

### tracking
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| shipment_id | UUID | FK → shipments |
| status | Enum | Same as shipments |
| location | String | Nullable |
| latitude | Float | Nullable |
| longitude | Float | Nullable |
| notes | String | Nullable |

### routes
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| shipment_id | UUID | FK → shipments, Unique |
| total_distance | Float | |
| estimated_days | Int | |
| optimized | Boolean | Default false |

### route_nodes
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| route_id | UUID | FK → routes |
| warehouse_id | UUID | FK → warehouses |
| sequence | Int | |
| distance_km | Float | |

## Indexes

- `shipments_tracking_number_idx` on shipments(tracking_number)
- `shipments_status_idx` on shipments(status)
- `tracking_shipment_idx` on tracking(shipment_id)
- `inventory_warehouse_sku_idx` unique on inventory(warehouse_id, sku)
