# Build Guide: Step-by-Step

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)

## Step 1: Project Setup

```bash
# Navigate to project
cd /Users/zen/Desktop/building-ai/docs_js_backend/projects/medium/MD16-food-delivery

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env and set DATABASE_URL
```

## Step 2: Database Setup

```bash
# Start PostgreSQL
docker-compose up -d db

# Run migrations
npx prisma migrate dev

# Generate Prisma client
npm run db:generate

# Seed database
npm run db:seed
```

## Step 3: Understanding the Schema

```prisma
model Order {
  id           String      @id @default(uuid())
  customerId   String
  restaurantId String
  driverId     String?     // Nullable until assigned
  status       OrderStatus @default(PLACED)
  total        Decimal     @db.Decimal(10, 2)
  address      String
  latitude     Float
  longitude    Float
  etaMinutes   Int?
  items        OrderItem[]
  tracking     Tracking[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model Driver {
  id          String   @id @default(uuid())
  userId      String   @unique
  isAvailable Boolean  @default(true)
  latitude    Float?
  longitude   Float?
  currentOrderId String? @unique
  orders      Order[]
}
```

## Step 4: Implement Order Service

```typescript
// src/services/orderService.ts
import { prisma } from '../utils/prisma.js';
import { OrderStatus } from '@prisma/client';

export class OrderService {
  async createOrder(data: CreateOrderInput) {
    // Step 4a: Fetch menu items with inventory
    const menuItems = await prisma.menu.findMany({
      where: {
        id: { in: data.items.map(i => i.menuId) },
        restaurantId: data.restaurantId,
      },
    });

    // Step 4b: Validate inventory
    let total = 0;
    const orderItems = data.items.map(item => {
      const menuItem = menuItems.find(m => m.id === item.menuId);
      if (!menuItem) throw new Error(`Menu item not found`);
      if (menuItem.inventory < item.quantity) {
        throw new Error(`Out of stock: ${menuItem.name}`);
      }
      total += Number(menuItem.price) * item.quantity;
      return { menuId: item.menuId, quantity: item.quantity, price: menuItem.price };
    });

    // Step 4c: Create order + decrement inventory in transaction
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId: data.customerId,
          restaurantId: data.restaurantId,
          status: OrderStatus.PLACED,
          total,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          items: { create: orderItems },
        },
        include: { items: { include: { menu: true } }, restaurant: true },
      });

      // Decrement inventory
      for (const item of data.items) {
        await tx.menu.update({
          where: { id: item.menuId },
          data: { inventory: { decrement: item.quantity } },
        });
      }

      return order;
    });
  }

  // Step 4d: Atomic driver assignment
  async assignDriver(orderId: string, driverId: string) {
    const result = await prisma.order.updateMany({
      where: { id: orderId, driverId: null },
      data: { driverId, status: OrderStatus.PICKED_UP },
    });

    if (result.count === 0) {
      throw new Error('Order already assigned or not found');
    }

    // Mark driver as unavailable
    await prisma.driver.update({
      where: { id: driverId },
      data: { isAvailable: false, currentOrderId: orderId },
    });

    return prisma.order.findUnique({
      where: { id: orderId },
      include: { driver: { include: { user: true } }, restaurant: true },
    });
  }
}
```

## Step 5: Implement Driver Service

```typescript
// src/services/driverService.ts
export class DriverService {
  async getAvailableDrivers() {
    return prisma.driver.findMany({
      where: { isAvailable: true },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
    });
  }

  async updateLocation(id: string, latitude: number, longitude: number) {
    return prisma.driver.update({
      where: { id },
      data: { latitude, longitude },
    });
  }
}
```

## Step 6: Implement ETA Calculation

```typescript
// src/utils/eta.ts
export function calculateETA(
  driverLat: number, 
  driverLng: number,
  destLat: number, 
  destLng: number
): number {
  const R = 6371;
  const dLat = toRad(destLat - driverLat);
  const dLon = toRad(destLng - driverLng);
  const a = 
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(driverLat)) * Math.cos(toRad(destLat)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  
  const urbanSpeedKmh = 30;
  return Math.ceil((distanceKm / urbanSpeedKmh) * 60);
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
```

## Step 7: Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- tests/app.test.ts
```

## Step 8: Start Development Server

```bash
npm run dev
```

API available at `http://localhost:3000`

## Step 9: Verify with curl

```bash
# Create an order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "uuid-here",
    "restaurantId": "uuid-here",
    "items": [{"menuId": "uuid-here", "quantity": 2}],
    "address": "456 Delivery Ave",
    "latitude": 40.7580,
    "longitude": -73.9855
  }'

# Assign driver (atomic)
curl -X PATCH http://localhost:3000/api/orders/:id/assign \
  -H "Content-Type: application/json" \
  -d '{"driverId": "uuid-here"}'
```
