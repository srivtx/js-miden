# 04-data-models.md

## WishlistItem

| Field       | Type   | Description              |
|-------------|--------|--------------------------|
| id          | string | Item ID                  |
| userId      | string | Owner identifier         |
| productId   | string | Product reference        |
| productName | string | Display name             |
| price       | number | Price at time of add     |
| addedAt     | Date   | Addition timestamp       |

## PriceChange

| Field     | Type   | Description           |
|-----------|--------|-----------------------|
| productId | string | Product reference     |
| oldPrice  | number | Previous price        |
| newPrice  | number | Current price         |
| changedAt | Date   | Detection timestamp   |
