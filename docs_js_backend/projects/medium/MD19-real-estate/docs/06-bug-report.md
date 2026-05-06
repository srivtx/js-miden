# Bug Report: Search Performance

## Bug 1: LIKE Search on Address

### Severity: HIGH

### Description
Property search uses ILIKE (case-insensitive LIKE) on the address field, which cannot use standard B-tree indexes efficiently. With millions of listings, search queries become extremely slow.

### Root Cause
In `SearchService.search()`, the code constructs a Prisma query with `contains` filters on multiple text fields:

```typescript
// Vulnerable code in searchService.ts
if (filters.location) {
  where.OR = [
    { address: { contains: filters.location, mode: 'insensitive' } },
    { city: { contains: filters.location, mode: 'insensitive' } },
    { state: { contains: filters.location, mode: 'insensitive' } },
    { zipCode: { contains: filters.location, mode: 'insensitive' } },
  ];
}
```

This generates SQL with `ILIKE '%term%'` which:
- Cannot use B-tree indexes
- Requires full table scan
- Gets slower as table grows

### Impact
- Search takes seconds with millions of listings
- Database CPU spikes
- Poor user experience
- Potential timeouts

### Fix Options

**Option 1: Full-Text Search**
```sql
-- Add tsvector column
ALTER TABLE listings ADD COLUMN search_vector tsvector;

-- Create index
CREATE INDEX listings_search_idx ON listings USING GIN(search_vector);

-- Update with concatenated fields
UPDATE listings SET search_vector = 
  to_tsvector('english', coalesce(address, '') || ' ' || coalesce(city, ''));
```

**Option 2: Trigram Index**
```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index
CREATE INDEX listings_address_trgm_idx ON listings USING GIN(address gin_trgm_ops);
```

**Option 3: Elasticsearch**
- Sync data to Elasticsearch
- Use Elasticsearch for all search queries
- Best performance but adds infrastructure

## Bug 2: No Geospatial Indexing

### Severity: HIGH

### Description
The nearby search functionality fetches ALL listings from the database and filters them in application code. This is extremely inefficient and will crash with large datasets.

### Root Cause
```typescript
// Vulnerable code in searchService.ts
async searchNearby(lat: number, lng: number, radiusMiles: number) {
  // BUG: Fetching ALL listings from database
  const allListings = await prisma.listing.findMany({
    where: { status: 'ACTIVE' },
  });

  // Filtering in application code - O(n) memory and CPU
  const nearby = allListings.filter((listing) => {
    const distance = this.calculateDistance(lat, lng, listing.latitude, listing.longitude);
    return distance <= radiusKm;
  });
  // ...
}
```

### Impact
- Memory exhaustion with large datasets
- CPU spikes on application servers
- Extremely slow response times
- Potential application crashes

### Fix Options

**Option 1: PostGIS Extension**
```sql
-- Enable PostGIS
CREATE EXTENSION postgis;

-- Add geometry column
ALTER TABLE listings ADD COLUMN location GEOGRAPHY(POINT);

-- Create spatial index
CREATE INDEX listings_location_idx ON listings USING GIST(location);

-- Query with ST_DWithin
SELECT * FROM listings 
WHERE ST_DWithin(
  location::geometry,
  ST_SetSRID(ST_MakePoint($1, $2), 4326),
  $3 * 1609.34 -- miles to meters
);
```

**Option 2: Bounding Box Pre-filter**
```typescript
// Pre-filter with bounding box (can use B-tree index on lat/lng)
const listings = await prisma.listing.findMany({
  where: {
    status: 'ACTIVE',
    latitude: { gte: minLat, lte: maxLat },
    longitude: { gte: minLng, lte: maxLng },
  },
});
// Then filter exact distance in application code
```

**Option 3: Geohash Indexing**
- Index listings by geohash
- Query nearby geohashes
- Good balance of simplicity and performance
