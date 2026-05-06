# MD20 Logistics — v2 Add TypeScript

## Goal
Add type safety to shipments, tracking, and warehouse data.

## Changes from v1
- Rename `.js` → `.ts`
- Add `tsconfig.json`
- Define interfaces for Shipment, Tracking, Warehouse

## New Interfaces

### `src/types/index.ts`
```typescript
export interface CreateShipmentInput {
  originId: string;
  destinationId: string;
  weight: number;
  createdBy: string;
}

export interface UpdateStatusInput {
  status: string;
  notes?: string;
}

export interface WarehouseInput {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}
```

## Updated Service

### `src/services/shipmentService.ts`
```typescript
import { db } from '../db.js';
import type { CreateShipmentInput } from '../types/index.js';

export class ShipmentService {
  async createShipment(data: CreateShipmentInput) {
    const trackingNumber = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;
    // TypeScript ensures all required fields exist
    // ...
  }
}
```

## Benefits
- `weight` typo caught at compile time
- Refactoring `originId` is safe
- Autocomplete for status enums

## Still Missing
- No validation on HTTP payloads
- No atomic status updates
