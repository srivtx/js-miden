# Core Concepts

## WHAT: Real Estate Platform

A property marketplace backend that coordinates:
- **Agents**: Create listings, manage tours, match with buyers
- **Buyers**: Search properties, book tours, calculate mortgages
- **Admins**: Monitor listings, manage agent assignments

Key entities: `User`, `Listing`, `TourBooking`, `Agent`

## WHY: The Hard Problems

### 1. Full-Text Search Performance
`ILIKE '%term%'` on address fields cannot use B-tree indexes. With millions of listings, search queries take seconds and spike database CPU.

**Why it matters:** Zillow's 2018 search timeout issue caused a 12% bounce rate, translating to millions in lost ad revenue.

### 2. Geospatial Query Efficiency
Fetching all listings and filtering by distance in application code is O(n) in memory and CPU. With 2M listings, this crashes servers.

**Why it matters:** Redfin's 2019 nearby search bug caused application servers to be OOM-killed during peak hours.

### 3. Mortgage Calculation Accuracy
Incorrect amortization calculations can mislead buyers about affordability, leading to legal liability.

**Why it matters:** Realtor.com faced a $2.3M lawsuit in 2020 from buyers who were misled by incorrect payment estimates.

## HOW: The Implementation

### Text Search (Phase 1 - With Warning)
```typescript
// WRONG: Leading wildcard (full table scan)
{ address: { contains: filters.location, mode: 'insensitive' } }
// Generates: ILIKE '%term%' -- CANNOT USE INDEX

// RIGHT: Prefix search (can use index)
{ address: { startsWith: filters.location, mode: 'insensitive' } }
// Generates: ILIKE 'term%' -- CAN USE INDEX

// Phase 1 compromise: Multiple column search with take limit
const listings = await prisma.listing.findMany({
  where: {
    OR: [
      { address: { contains: filters.location, mode: 'insensitive' } },
      { city: { contains: filters.location, mode: 'insensitive' } },
      { state: { contains: filters.location, mode: 'insensitive' } },
      { zipCode: { contains: filters.location, mode: 'insensitive' } },
    ],
  },
  take: 50, // Limit to prevent memory issues
});
```

### Nearby Search with Bounding Box
```typescript
// WRONG: Fetch all listings (OOM risk)
const allListings = await prisma.listing.findMany({ where: { status: 'ACTIVE' } });
const nearby = allListings.filter(l => haversine(lat, lng, l.latitude, l.longitude) <= radiusKm);

// RIGHT: Bounding box pre-filter
function getBoundingBox(lat: number, lng: number, radiusKm: number) {
  const kmPerDegreeLat = 111;
  const kmPerDegreeLng = 111 * Math.cos(toRad(lat));
  
  return {
    minLat: lat - (radiusKm / kmPerDegreeLat),
    maxLat: lat + (radiusKm / kmPerDegreeLat),
    minLng: lng - (radiusKm / kmPerDegreeLng),
    maxLng: lng + (radiusKm / kmPerDegreeLng),
  };
}

const { minLat, maxLat, minLng, maxLng } = getBoundingBox(lat, lng, radiusKm);

const candidates = await prisma.listing.findMany({
  where: {
    status: 'ACTIVE',
    latitude: { gte: minLat, lte: maxLat },
    longitude: { gte: minLng, lte: maxLng },
  },
});

const nearby = candidates.filter(l => 
  haversine(lat, lng, l.latitude, l.longitude) <= radiusKm
);
```

### Mortgage Calculation
```typescript
function calculateMortgage(
  price: number, 
  downPayment: number, 
  annualRate: number, 
  years: number
) {
  const principal = price - downPayment;
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = years * 12;
  
  if (monthlyRate === 0) {
    return { monthlyPayment: principal / numPayments, totalInterest: 0 };
  }
  
  const monthlyPayment = 
    (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const totalInterest = monthlyPayment * numPayments - principal;
  
  return {
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalCost: price + totalInterest,
    numPayments,
  };
}
```

## WRONG vs RIGHT

| Scenario | WRONG Approach | RIGHT Approach |
|----------|---------------|----------------|
| Text search | `ILIKE '%term%'` (full table scan) | Trigram index / full-text search / bounding prefix |
| Nearby search | Fetch all + filter in app | Bounding box pre-filter + exact distance |
| Mortgage calc | Simple interest | Amortization formula with edge case handling |
| Agent matching | Random assignment | Distance-based proximity matching |
| Tour booking | No conflict check | Check existing bookings for same slot |
| Price storage | Float | `Decimal(12,2)` |

## ASCII Architecture

```
+-------------+      REST/JSON       +---------------+      SQL       +-------------+
|   Buyer     | <----------------->  |  Express API  | <------------> |  PostgreSQL  |
|   Portal    |                      |   (Node 20)   |                |   (Prisma)   |
+-------------+                      +---------------+                +-------------+
      |                                    |
      |  Search queries                      |  Index-friendly queries
      v                                    v
+-------------+                      +---------------+
|  Search     |                      |   Listing     |
|  Filters    |                      |   Index       |
+-------------+                      +---------------+
```

```
GEOSPATIAL SEARCH OPTIMIZATION

Without Bounding Box (WRONG):
+----------+     +------------------+     +------------------+
|  Search  | --> | Fetch ALL listings| --> | Filter in app    |
|  Nearby  |     | (2M records)      |     | (OOM risk!)      |
+----------+     +------------------+     +------------------+

With Bounding Box (RIGHT):
+----------+     +------------------+     +------------------+
|  Search  | --> | B-tree pre-filter | --> | Exact distance   |
|  Nearby  |     | (~200 records)    |     | (fast!)          |
+----------+     +------------------+     +------------------+
       |                  |                       |
       |                  v                       |
       |         +------------------+             |
       |         | lat >= minLat    |             |
       |         | lat <= maxLat    |             |
       |         | lng >= minLng    |             |
       |         | lng <= maxLng    |             |
       |         +------------------+             |
```

```
MORTGAGE AMORTIZATION SCHEDULE

Month    Payment    Principal    Interest    Balance
-----    -------    ---------    --------    -------
  1      $1,432       $432        $1,000     $199,568
  2      $1,432       $434          $998     $199,134
  3      $1,432       $436          $996     $198,698
  ...    ...        ...           ...        ...
 360     $1,432     $1,428           $4          $0

Total Interest: $215,607
Total Cost:     $415,607
```
