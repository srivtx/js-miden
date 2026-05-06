# MD19 Real Estate — v2 Add TypeScript

## Goal
Add type safety to listings, tours, and mortgage calculations.

## Changes from v1
- Rename `.js` → `.ts`
- Add `tsconfig.json`
- Define interfaces for Listing, Tour, SearchFilters

## New Interfaces

### `src/types/index.ts`
```typescript
export interface ListingInput {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  price: number;
  beds: number;
  baths: number;
  propertyType: string;
  latitude: number;
  longitude: number;
}

export interface SearchFilters {
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  baths?: number;
  propertyType?: string;
}

export interface TourInput {
  listingId: string;
  userId: string;
  scheduledAt: string;
}
```

## Updated Service

### `src/services/searchService.ts`
```typescript
import { db } from '../db.js';
import type { SearchFilters } from '../types/index.js';

export class SearchService {
  async search(filters: SearchFilters) {
    // TypeScript ensures filters shape is correct
    // Still naive LIKE queries
    // ...
  }
}
```

## Benefits
- `price` typo caught at compile time
- Refactoring `zipCode` is safe
- Autocomplete for filter keys

## Still Missing
- No validation on search params
- No geospatial indexing
