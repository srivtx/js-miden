# API Specification

## Rides

### POST /api/rides
Request a new ride.

**Request:**
```json
{
  "riderId": "uuid",
  "pickupAddress": "123 Main St",
  "pickupLat": 40.758,
  "pickupLng": -73.9855,
  "dropoffAddress": "456 Broadway",
  "dropoffLat": 40.7489,
  "dropoffLng": -73.968
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "status": "REQUESTED",
    "totalFare": 15.50,
    "distanceKm": 3.5,
    "estimatedMinutes": 12,
    "surgeMultiplier": 1.5
  }
}
```

### GET /api/rides/:id
Get ride details.

### PATCH /api/rides/:id/accept
Accept ride request.

**Request:**
```json
{
  "driverId": "uuid"
}
```

### PATCH /api/rides/:id/complete
Complete ride.

### GET /api/rides/fare
Calculate estimated fare.

**Query Parameters:**
- `distance` - Distance in km
- `minutes` - Estimated time
- `surge` - Surge multiplier (optional)

## Drivers

### GET /api/drivers/available
Get available drivers.

### PATCH /api/drivers/:id/location
Update driver location.

**Request:**
```json
{
  "latitude": 40.758,
  "longitude": -73.9855
}
```

### PATCH /api/drivers/:id/availability
Toggle availability.

**Request:**
```json
{
  "available": false
}
```

## Reviews

### POST /api/reviews
Submit a review.

**Request:**
```json
{
  "rideId": "uuid",
  "reviewerId": "uuid",
  "rating": 5,
  "comment": "Great driver!"
}
```

### GET /api/reviews/ride/:rideId
Get review for a ride.

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Human-readable description"
}
```
