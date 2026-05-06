# API Specification

## Shipments

### POST /api/shipments
Create a new shipment.

**Request:**
```json
{
  "originId": "uuid",
  "destinationId": "uuid",
  "weight": 50.5,
  "createdBy": "uuid"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "trackingNumber": "TRK...",
    "status": "CREATED",
    "origin": {...},
    "destination": {...}
  }
}
```

### GET /api/shipments/:id
Get shipment details with tracking history.

### GET /api/shipments/tracking/:trackingNumber
Track shipment by tracking number.

### PATCH /api/shipments/:id/status
Update shipment status.

**Request:**
```json
{
  "status": "IN_TRANSIT"
}
```

### PATCH /api/shipments/:id/deliver
Confirm delivery.

## Tracking

### GET /api/tracking/:shipmentId
Get tracking history.

### POST /api/tracking/:shipmentId
Add tracking event.

**Request:**
```json
{
  "status": "IN_TRANSIT",
  "location": "Chicago, IL",
  "notes": "Arrived at sorting facility"
}
```

## Warehouses

### GET /api/warehouses
List all warehouses.

### POST /api/warehouses
Create a warehouse.

## Routes

### POST /api/routes
Create a route for a shipment.

**Request:**
```json
{
  "shipmentId": "uuid"
}
```

### GET /api/routes/shipment/:shipmentId
Get route for shipment.

### PATCH /api/routes/:id/optimize
Optimize existing route.

## Inventory

### GET /api/inventory/:warehouseId
Get warehouse inventory.

### PATCH /api/inventory/:warehouseId
Update inventory item.

**Request:**
```json
{
  "sku": "ITEM-001",
  "quantity": 150
}
```
