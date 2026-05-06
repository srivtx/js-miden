# MD17 Ride Sharing — v2 Add TypeScript

## Goal
Add type safety to prevent runtime crashes from malformed ride requests.

## Changes from v1
- All `.js` → `.ts`
- Add `tsconfig.json` with `strict: true`
- Introduce domain types for Ride, Driver, Rider

## New Interfaces

### `src/types/index.ts`
```typescript
export interface RequestRideInput {
  riderId: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
}

export interface DriverInput {
  userId: string;
}

export interface LocationInput {
  latitude: number;
  longitude: number;
}
```

## Updated Service

### `src/services/rideService.ts`
```typescript
import { db } from '../db.js';
import type { RequestRideInput } from '../types/index.js';

export class RideService {
  async requestRide(data: RequestRideInput) {
    const distanceKm = this.calculateDistance(
      data.pickupLat, data.pickupLng,
      data.dropoffLat, data.dropoffLng
    );
    const estimatedMinutes = Math.ceil((distanceKm / 30) * 60);
    // TypeScript ensures all required fields exist
    // ...
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
```

## Benefits
- `pickupLat` / `pickupLng` typos caught at compile time
- Refactoring `RideStatus` enum is safe across the codebase
- Autocomplete for Prisma client methods

## Still Missing
- No validation layer on HTTP requests
- No tests for fare accuracy
