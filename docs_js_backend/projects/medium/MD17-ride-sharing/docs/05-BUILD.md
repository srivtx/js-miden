# Build Guide: Step-by-Step

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)

## Step 1: Project Setup

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/medium/MD17-ride-sharing
npm install
cp .env.example .env
# Edit DATABASE_URL
```

## Step 2: Database Setup

```bash
docker-compose up -d db
npx prisma migrate dev
npm run db:seed
```

## Step 3: Schema Overview

```prisma
model Ride {
  id              String     @id @default(uuid())
  riderId         String
  driverId        String?    // Nullable until accepted
  status          RideStatus @default(REQUESTED)
  pickupAddress   String
  pickupLat       Float
  pickupLng       Float
  dropoffAddress  String
  dropoffLat      Float
  dropoffLng      Float
  baseFare        Decimal    @db.Decimal(10, 2)
  distanceFare    Decimal    @db.Decimal(10, 2)
  timeFare        Decimal    @db.Decimal(10, 2)
  surgeMultiplier Decimal    @db.Decimal(3, 2) @default(1.00)
  totalFare       Decimal    @db.Decimal(10, 2)
  distanceKm      Float
  estimatedMinutes Int
  actualMinutes   Int?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
}

model Driver {
  id          String   @id @default(uuid())
  userId      String   @unique
  isAvailable Boolean  @default(true)
  latitude    Float?
  longitude   Float?
  vehicleType String
  licensePlate String
  rating      Float    @default(5.0)
  updatedAt   DateTime @updatedAt
}
```

## Step 4: Implement Ride Service

```typescript
// src/services/rideService.ts
import { prisma } from '../utils/prisma.js';
import { RideStatus } from '@prisma/client';

export class RideService {
  async requestRide(data: RequestRideInput) {
    // Step 4a: Calculate distance
    const distanceKm = this.calculateDistance(
      data.pickupLat, data.pickupLng,
      data.dropoffLat, data.dropoffLng
    );
    const estimatedMinutes = Math.ceil((distanceKm / 30) * 60);

    // Step 4b: Calculate surge (ATOMIC)
    const surgeMultiplier = await this.getSurgeMultiplier(
      data.pickupLat, data.pickupLng
    );

    // Step 4c: Calculate fare components
    const baseFare = 2.50;
    const distanceFare = distanceKm * 1.50;
    const timeFare = estimatedMinutes * 0.35;
    const totalFare = (baseFare + distanceFare + timeFare) * surgeMultiplier;

    // Step 4d: Create ride
    return prisma.ride.create({
      data: {
        riderId: data.riderId,
        status: RideStatus.REQUESTED,
        pickupAddress: data.pickupAddress,
        pickupLat: data.pickupLat,
        pickupLng: data.pickupLng,
        dropoffAddress: data.dropoffAddress,
        dropoffLat: data.dropoffLat,
        dropoffLng: data.dropoffLng,
        baseFare,
        distanceFare,
        timeFare,
        surgeMultiplier,
        totalFare,
        distanceKm,
        estimatedMinutes,
      },
      include: { rider: { include: { user: true } } },
    });
  }

  // Atomic surge calculation
  private async getSurgeMultiplier(lat: number, lng: number): Promise<number> {
    const { demand, supply } = await prisma.$transaction(async (tx) => {
      const demandResult = await tx.ride.groupBy({
        by: ['status'],
        where: {
          status: 'REQUESTED',
          pickupLat: { gte: lat - 0.1, lte: lat + 0.1 },
          pickupLng: { gte: lng - 0.1, lte: lng + 0.1 },
        },
        _count: { status: true },
      });
      
      const supplyResult = await tx.driver.count({
        where: {
          isAvailable: true,
          latitude: { gte: lat - 0.1, lte: lat + 0.1 },
          longitude: { gte: lng - 0.1, lte: lng + 0.1 },
        },
      });
      
      return {
        demand: demandResult[0]?._count.status || 0,
        supply: supplyResult || 1,
      };
    });

    const ratio = demand / supply;
    if (ratio > 2.0) return 2.5;
    if (ratio > 1.5) return 2.0;
    if (ratio > 1.0) return 1.5;
    return 1.0;
  }

  async acceptRide(id: string, driverId: string) {
    return prisma.ride.update({
      where: { id },
      data: { driverId, status: RideStatus.ACCEPTED },
      include: { driver: { include: { user: true } } },
    });
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
```

## Step 5: Implement Driver Service with Timestamp Validation

```typescript
// src/services/driverService.ts
export class DriverService {
  async updateLocation(id: string, latitude: number, longitude: number, timestamp: number) {
    const driver = await prisma.driver.findUnique({ where: { id } });
    
    if (!driver) throw new Error('Driver not found');
    
    // Reject stale updates
    if (driver.updatedAt && timestamp <= driver.updatedAt.getTime()) {
      throw new Error('Stale location update rejected');
    }
    
    return prisma.driver.update({
      where: { id },
      data: { latitude, longitude },
    });
  }

  async toggleAvailability(id: string, available: boolean) {
    return prisma.driver.update({
      where: { id },
      data: { isAvailable: available },
    });
  }
}
```

## Step 6: Implement Review Service

```typescript
// src/services/reviewService.ts
export class ReviewService {
  async createReview(data: { rideId: string; reviewerId: string; rating: number; comment?: string }) {
    // Ensure ride exists and is completed
    const ride = await prisma.ride.findUnique({ where: { id: data.rideId } });
    if (!ride || ride.status !== 'COMPLETED') {
      throw new Error('Ride not found or not completed');
    }
    
    // Prevent duplicate reviews
    const existing = await prisma.review.findUnique({ where: { rideId: data.rideId } });
    if (existing) throw new Error('Review already exists for this ride');
    
    return prisma.review.create({
      data: {
        rideId: data.rideId,
        reviewerId: data.reviewerId,
        rating: data.rating,
        comment: data.comment,
      },
    });
  }
}
```

## Step 7: Run Tests

```bash
npm test
npm test -- --coverage
```

## Step 8: Start Server

```bash
npm run dev
```

API at `http://localhost:3001`

## Step 9: Verify

```bash
# Request ride
curl -X POST http://localhost:3001/api/rides \
  -H "Content-Type: application/json" \
  -d '{
    "riderId": "uuid",
    "pickupAddress": "123 Main St",
    "pickupLat": 40.758,
    "pickupLng": -73.9855,
    "dropoffAddress": "456 Broadway",
    "dropoffLat": 40.7489,
    "dropoffLng": -73.968
  }'

# Accept ride
curl -X PATCH http://localhost:3001/api/rides/:id/accept \
  -H "Content-Type: application/json" \
  -d '{"driverId": "uuid"}'
```
