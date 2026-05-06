# API Specification

## Listings

### GET /api/listings
List all active properties.

### GET /api/listings/:id
Get property details.

### POST /api/listings
Create a new listing.

**Request:**
```json
{
  "title": "Property Title",
  "address": "123 Main St",
  "city": "Austin",
  "state": "TX",
  "zipCode": "78701",
  "price": 450000,
  "beds": 4,
  "baths": 3,
  "sqft": 2400,
  "latitude": 30.2672,
  "longitude": -97.7431,
  "propertyType": "HOUSE"
}
```

## Search

### GET /api/search
Search properties with filters.

**Query Parameters:**
- `location` - Search in address, city, state, zip
- `minPrice` - Minimum price
- `maxPrice` - Maximum price
- `beds` - Minimum bedrooms
- `baths` - Minimum bathrooms
- `propertyType` - Type of property

### GET /api/search/nearby
Find properties within radius.

**Query Parameters:**
- `lat` - Latitude
- `lng` - Longitude
- `radius` - Radius in miles (default: 5)

## Tours

### POST /api/tours
Book a property tour.

**Request:**
```json
{
  "listingId": "uuid",
  "userId": "uuid",
  "date": "2024-01-20T10:00:00Z",
  "notes": "Please call before arriving"
}
```

## Agents

### GET /api/agents
List all agents.

### GET /api/agents/match
Match with nearest agent.

**Query Parameters:**
- `lat` - Latitude
- `lng` - Longitude

## Calculator

### GET /api/calculator/mortgage
Calculate mortgage payments.

**Query Parameters:**
- `price` - Property price
- `downPayment` - Down payment amount
- `interestRate` - Annual interest rate (%)
- `years` - Loan term in years
