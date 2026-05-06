# API Specification

## Restaurants

### GET /api/restaurants
List all restaurants.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Restaurant Name",
      "address": "123 Main St",
      "cuisine": "Italian",
      "rating": 4.5,
      "isOpen": true,
      "_count": {
        "orders": 150
      }
    }
  ]
}
```

### GET /api/restaurants/:id
Get restaurant details with menu.

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Restaurant Name",
    "menus": [
      {
        "id": "uuid",
        "name": "Pizza",
        "price": 15.99,
        "category": "Main",
        "isAvailable": true
      }
    ]
  }
}
```

## Orders

### POST /api/orders
Create a new order.

**Request:**
```json
{
  "customerId": "uuid",
  "restaurantId": "uuid",
  "items": [
    { "menuId": "uuid", "quantity": 2 }
  ],
  "address": "456 Delivery Ave",
  "latitude": 40.7580,
  "longitude": -73.9855
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "PLACED",
    "total": 31.98,
    "items": [...]
  }
}
```

### PATCH /api/orders/:id/status
Update order status.

**Request:**
```json
{
  "status": "PREPARING"
}
```

### PATCH /api/orders/:id/assign
Assign driver to order.

**Request:**
```json
{
  "driverId": "uuid"
}
```

## Drivers

### GET /api/drivers/available
Get available drivers.

### PATCH /api/drivers/:id/location
Update driver location.

**Request:**
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060
}
```

## Tracking

### GET /api/tracking/:orderId
Get tracking history for order.

### POST /api/tracking/:orderId
Update tracking location.

**Request:**
```json
{
  "latitude": 40.7500,
  "longitude": -73.9900
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable description"
}
```

Common status codes:
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error
