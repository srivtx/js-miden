# Database Schema

## Entity Relationship Diagram

```
┌─────────┐     ┌──────────┐     ┌─────────────┐
│  User   │────▶│ Listing  │◀────│ TourBooking │
└─────────┘     └──────────┘     └─────────────┘
                     │
                     ▼
                ┌──────────┐
                │  Agent   │
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
| phone | String | Nullable |
| role | Enum | BUYER, SELLER, AGENT, ADMIN |

### listings
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| title | String | |
| description | String | Nullable |
| address | String | |
| city | String | |
| state | String | |
| zip_code | String | |
| price | Decimal(12,2) | |
| beds | Int | |
| baths | Float | |
| sqft | Int | |
| latitude | Float | |
| longitude | Float | |
| property_type | String | |
| status | Enum | ACTIVE, PENDING, SOLD, WITHDRAWN |
| agent_id | UUID | FK → users, Nullable |

### tour_bookings
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| listing_id | UUID | FK → listings |
| user_id | UUID | FK → users |
| date | DateTime | |
| status | Enum | CONFIRMED, CANCELLED, COMPLETED, NO_SHOW |
| notes | String | Nullable |

### agents
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → users, Unique |
| license | String | |
| specialty | String | Nullable |
| rating | Float | Default 0 |
| sales_count | Int | Default 0 |
| latitude | Float | Nullable |
| longitude | Float | Nullable |

## Indexes

- `listings_status_idx` on listings(status)
- `listings_price_idx` on listings(price)
- `listings_beds_idx` on listings(beds)
- `listings_property_type_idx` on listings(property_type)
- `tour_bookings_listing_idx` on tour_bookings(listing_id)
