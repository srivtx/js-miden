# 04-data-models.md

## CartItem

| Field       | Type   | Description          |
|-------------|--------|----------------------|
| productId   | string | Product reference    |
| productName | string | Display name         |
| quantity    | number | Units in cart        |
| price       | number | Unit price           |

## Cart

| Field     | Type      | Description           |
|-----------|-----------|-----------------------|
| id        | string    | Cart session ID       |
| items     | CartItem[]| Cart contents         |
| total     | number    | Computed total        |
| createdAt | Date      | Cart creation time    |
| updatedAt | Date      | Last mutation time    |
