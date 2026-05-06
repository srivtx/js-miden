# Build Guide: Step-by-Step

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)

## Step 1: Project Setup

```bash
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/medium/MD20-logistics
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
model Shipment {
  id             String        @id @default(uuid())
  trackingNumber String        @unique
  status         ShipmentStatus @default(CREATED)
  originId       String
  destinationId  String
  weight         Float
  createdBy      String
  deliveredAt    DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  
  origin      Warehouse @relation("Origin", fields: [originId], references: [id])
  destination Warehouse @relation("Destination", fields: [destinationId], references: [id])
  tracking    Tracking[]
  route       Route?    @relation("ShipmentRoute")
}

model Route {
  id            String   @id @default(uuid())
  shipmentId    String   @unique
  totalDistance Float
  estimatedDays Int
  optimized     Boolean  @default(false)
  nodes         RouteNode[]
}

model RouteNode {
  id          String @id @default(uuid())
  routeId     String
  warehouseId String
  sequence    Int
  distanceKm  Float
}
```

## Step 4: Implement Shipment Service

```typescript
// src/services/shipmentService.ts
import { prisma } from '../utils/prisma.js';
import { ShipmentStatus } from '@prisma/client';

export class ShipmentService {
  async createShipment(data: CreateShipmentInput) {
    const trackingNumber = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          trackingNumber,
          status: ShipmentStatus.CREATED,
          originId: data.originId,
          destinationId: data.destinationId,
          weight: data.weight,
          createdBy: data.createdBy,
        },
        include: { origin: true, destination: true },
      });
      
      // Create initial tracking event (ATOMIC)
      await tx.tracking.create({
        data: {
          shipmentId: shipment.id,
          status: ShipmentStatus.CREATED,
          notes: 'Shipment created',
        },
      });
      
      return shipment;
    });
  }

  async updateStatus(id: string, status: ShipmentStatus) {
    // ATOMIC: Status + tracking in transaction
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.update({
        where: { id },
        data: { status },
      });
      
      await tx.tracking.create({
        data: {
          shipmentId: id,
          status,
          notes: `Status updated to ${status}`,
        },
      });
      
      return shipment;
    });
  }

  async confirmDelivery(id: string) {
    return prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.update({
        where: { id },
        data: {
          status: ShipmentStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });
      
      await tx.tracking.create({
        data: {
          shipmentId: id,
          status: ShipmentStatus.DELIVERED,
          notes: 'Package delivered',
        },
      });
      
      return shipment;
    });
  }
}
```

## Step 5: Implement Route Service

```typescript
// src/services/routeService.ts
export class RouteService {
  async createRoute(shipmentId: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { origin: true, destination: true },
    });
    if (!shipment) throw new Error('Shipment not found');
    
    const warehouses = await prisma.warehouse.findMany();
    const routeNodes = this.calculateRoute(
      shipment.origin,
      shipment.destination,
      warehouses
    );
    
    const totalDistance = routeNodes.reduce((sum, node) => sum + node.distanceKm, 0);
    
    return prisma.route.create({
      data: {
        shipmentId,
        totalDistance,
        estimatedDays: Math.ceil(totalDistance / 800),
        nodes: {
          create: routeNodes.map((node, index) => ({
            warehouseId: node.warehouseId,
            sequence: index,
            distanceKm: node.distanceKm,
          })),
        },
      },
      include: {
        nodes: { include: { warehouse: true }, orderBy: { sequence: 'asc' } },
      },
    });
  }

  private calculateRoute(origin: any, destination: any, warehouses: any[]) {
    const nodes: Array<{ warehouseId: string; distanceKm: number }> = [];
    let current = origin;
    nodes.push({ warehouseId: origin.id, distanceKm: 0 });
    
    const visited = new Set([origin.id]);
    const maxHops = 5;
    
    for (let i = 0; i < maxHops; i++) {
      let nearest = null;
      let minDist = Infinity;
      
      for (const wh of warehouses) {
        if (visited.has(wh.id)) continue;
        
        const dist = this.haversine(
          current.latitude, current.longitude,
          wh.latitude, wh.longitude
        );
        
        // Direction check: must bring us closer to destination
        const distToDestBefore = this.haversine(
          current.latitude, current.longitude,
          destination.latitude, destination.longitude
        );
        const distToDestAfter = this.haversine(
          wh.latitude, wh.longitude,
          destination.latitude, destination.longitude
        );
        
        if (distToDestAfter > distToDestBefore * 1.5) continue;
        
        if (dist < minDist) {
          minDist = dist;
          nearest = wh;
        }
      }
      
      if (!nearest) break;
      
      nodes.push({ warehouseId: nearest.id, distanceKm: minDist });
      visited.add(nearest.id);
      current = nearest;
      
      const distToDest = this.haversine(
        current.latitude, current.longitude,
        destination.latitude, destination.longitude
      );
      if (distToDest < 100) break;
    }
    
    const finalDist = this.haversine(
      current.latitude, current.longitude,
      destination.latitude, destination.longitude
    );
    nodes.push({ warehouseId: destination.id, distanceKm: finalDist });
    
    return nodes;
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

## Step 6: Implement Inventory Service

```typescript
// src/services/inventoryService.ts
export class InventoryService {
  async updateInventory(warehouseId: string, sku: string, quantity: number) {
    return prisma.inventory.upsert({
      where: { warehouseId_sku: { warehouseId, sku } },
      update: { quantity },
      create: { warehouseId, sku, quantity },
    });
  }

  async getInventory(warehouseId: string) {
    return prisma.inventory.findMany({
      where: { warehouseId },
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

API at `http://localhost:3004`

## Step 9: Verify

```bash
# Create shipment
curl -X POST http://localhost:3004/api/shipments \
  -H "Content-Type: application/json" \
  -d '{"originId": "uuid", "destinationId": "uuid", "weight": 50.5, "createdBy": "uuid"}'

# Update status (atomic)
curl -X PATCH http://localhost:3004/api/shipments/:id/status \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_TRANSIT"}'

# Create route
curl -X POST http://localhost:3004/api/routes \
  -H "Content-Type: application/json" \
  -d '{"shipmentId": "uuid"}'

# Track by number
curl http://localhost:3004/api/shipments/tracking/TRK123456
```
