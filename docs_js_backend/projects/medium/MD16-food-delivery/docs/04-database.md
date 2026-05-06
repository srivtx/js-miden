# Database Schema

## Entity Relationship Diagram

```
┌─────────┐     ┌──────────────┐     ┌───────────┐
│  User   │────▶│ Restaurant   │◀────│   Menu    │
└─────────┘     └──────────────┘     └───────────┘
     │                                    │
     │         ┌──────────┐              │
     └────────▶│  Order   │◀─────────────┘
               └──────────┘
                    │  │
                    │  └────▶ OrderItem
                    │
                    ▼
              ┌──────────┐
              │  Driver  │
              └──────────┘
                    │
                    ▼
               ┌─────────┐
               │ Tracking│
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
| role | Enum | CUSTOMER, RESTAURANT_OWNER, DRIVER, ADMIN |
| created_at | Timestamp | |
| updated_at | Timestamp | |

### restaurants
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | String | |
| description | String | Nullable |
| address | String | |
| latitude | Float | |
| longitude | Float | |
| cuisine | String | |
| rating | Float | Default 0 |
| is_open | Boolean | Default true |
| owner_id | UUID | FK → users |

### menus
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| restaurant_id | UUID | FK → restaurants |
| name | String | |
| description | String | Nullable |
| price | Decimal(10,2) | |
| category | String | |
| is_available | Boolean | Default true |
| inventory | Int | Default 0 |

### orders
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| customer_id | UUID | FK → users |
| restaurant_id | UUID | FK → restaurants |
| driver_id | UUID | FK → drivers, Nullable |
| status | Enum | PLACED, PREPARING, READY, PICKED_UP, DELIVERED, CANCELLED |
| total | Decimal(10,2) | |
| address | String | |
| latitude | Float | |
| longitude | Float | |
| eta_minutes | Int | Nullable |

### order_items
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| menu_id | UUID | FK → menus |
| quantity | Int | |
| price | Decimal(10,2) | |

### drivers
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users, Unique |
| is_available | Boolean | Default true |
| latitude | Float | Nullable |
| longitude | Float | Nullable |
| current_order_id | UUID | FK → orders, Unique, Nullable |

### tracking
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| order_id | UUID | FK → orders |
| latitude | Float | |
| longitude | Float | |
| timestamp | Timestamp | |

## Indexes

- `orders_customer_id_idx` on orders(customer_id)
- `orders_driver_id_idx` on orders(driver_id)
- `orders_status_idx` on orders(status)
- `menus_restaurant_id_idx` on menus(restaurant_id)
- `tracking_order_id_idx` on tracking(order_id)
- `drivers_available_idx` on drivers(is_available)
