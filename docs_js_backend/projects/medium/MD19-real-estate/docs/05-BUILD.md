# Build Guide: Step-by-Step

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)

## Step 1: Project Setup

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/medium/MD19-real-estate
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
model Listing {
  id          String   @id @default(uuid())
  title       String
  description String?
  address     String
  city        String
  state       String
  zipCode     String   @map("zip_code")
  price       Decimal  @db.Decimal(12, 2)
  beds        Int
  baths       Float
  sqft        Int
  latitude    Float
  longitude   Float
  propertyType String  @map("property_type")
  status      ListingStatus @default(ACTIVE)
  agentId     String?  @map("agent_id")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Agent {
  id         String  @id @default(uuid())
  userId     String  @unique
  license    String
  specialty  String?
  rating     Float   @default(0)
  salesCount Int     @default(0)
  latitude   Float?
  longitude  Float?
}
```

## Step 4: Implement Search Service

```typescript
// src/services/searchService.ts
import { prisma } from '../utils/prisma.js';

export class SearchService {
  async search(filters: SearchFilters) {
    const where: any = { status: 'ACTIVE' };

    // Phase 1: ILIKE search (will degrade at scale)
    if (filters.location) {
      where.OR = [
        { address: { contains: filters.location, mode: 'insensitive' } },
        { city: { contains: filters.location, mode: 'insensitive' } },
        { state: { contains: filters.location, mode: 'insensitive' } },
        { zipCode: { contains: filters.location, mode: 'insensitive' } },
      ];
    }

    if (filters.minPrice !== undefined) {
      where.price = { ...where.price, gte: filters.minPrice };
    }
    if (filters.maxPrice !== undefined) {
      where.price = { ...where.price, lte: filters.maxPrice };
    }
    if (filters.beds !== undefined) {
      where.beds = { gte: filters.beds };
    }
    if (filters.baths !== undefined) {
      where.baths = { gte: filters.baths };
    }
    if (filters.propertyType) {
      where.propertyType = filters.propertyType;
    }

    return prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to prevent memory issues
    });
  }

  // Bounding box pre-filter for nearby search
  async searchNearby(lat: number, lng: number, radiusMiles: number) {
    const radiusKm = radiusMiles * 1.60934;
    const { minLat, maxLat, minLng, maxLng } = this.getBoundingBox(lat, lng, radiusKm);

    // Step 1: B-tree pre-filter
    const candidates = await prisma.listing.findMany({
      where: {
        status: 'ACTIVE',
        latitude: { gte: minLat, lte: maxLat },
        longitude: { gte: minLng, lte: maxLng },
      },
    });

    // Step 2: Exact distance filter
    const nearby = candidates.filter(listing => {
      const distance = this.haversine(lat, lng, listing.latitude, listing.longitude);
      return distance <= radiusKm;
    });

    // Sort by distance
    nearby.sort((a, b) => {
      const distA = this.haversine(lat, lng, a.latitude, a.longitude);
      const distB = this.haversine(lat, lng, b.latitude, b.longitude);
      return distA - distB;
    });

    return nearby.slice(0, 50);
  }

  private getBoundingBox(lat: number, lng: number, radiusKm: number) {
    const kmPerDegreeLat = 111;
    const kmPerDegreeLng = 111 * Math.cos(this.toRad(lat));
    
    return {
      minLat: lat - (radiusKm / kmPerDegreeLat),
      maxLat: lat + (radiusKm / kmPerDegreeLat),
      minLng: lng - (radiusKm / kmPerDegreeLng),
      maxLng: lng + (radiusKm / kmPerDegreeLng),
    };
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

## Step 5: Implement Calculator Service

```typescript
// src/services/calculatorService.ts
export class CalculatorService {
  calculateMortgage(price: number, downPayment: number, annualRate: number, years: number) {
    const principal = price - downPayment;
    const monthlyRate = annualRate / 100 / 12;
    const numPayments = years * 12;

    if (monthlyRate === 0) {
      return {
        monthlyPayment: principal / numPayments,
        totalInterest: 0,
        totalCost: price,
        numPayments,
      };
    }

    const monthlyPayment = 
      (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);

    const totalInterest = monthlyPayment * numPayments - principal;

    return {
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalCost: Math.round((price + totalInterest) * 100) / 100,
      numPayments,
    };
  }
}
```

## Step 6: Implement Agent Matching

```typescript
// src/services/agentService.ts
export class AgentService {
  async findNearestAgent(lat: number, lng: number) {
    const agents = await prisma.agent.findMany();
    
    let nearest = null;
    let minDist = Infinity;
    
    for (const agent of agents) {
      if (agent.latitude == null || agent.longitude == null) continue;
      
      const dist = this.haversine(lat, lng, agent.latitude, agent.longitude);
      if (dist < minDist) {
        minDist = dist;
        nearest = agent;
      }
    }
    
    return nearest;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

## Step 7: Run Tests

```bash
npm test
npm test -- --coverage
```

## Step 8: Start Server

```bash
npm run dev
```

API at `http://localhost:3003`

## Step 9: Verify

```bash
# Search properties
curl "http://localhost:3003/api/search?location=Austin&minPrice=300000&beds=3"

# Search nearby
curl "http://localhost:3003/api/search/nearby?lat=30.2672&lng=-97.7431&radius=5"

# Calculate mortgage
curl "http://localhost:3003/api/calculator/mortgage?price=450000&downPayment=90000&interestRate=6.5&years=30"

# Book tour
curl -X POST http://localhost:3003/api/tours \
  -H "Content-Type: application/json" \
  -d '{"listingId": "uuid", "userId": "uuid", "date": "2024-01-20T10:00:00Z"}'
```
