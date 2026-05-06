# MD20 Logistics — v7 Production Setup

## Goal
Deploy the logistics API with PostgreSQL, Docker, and production hardening.

## Changes from v6
- Add `Dockerfile` + `docker-compose.yml`
- Switch to PostgreSQL via Prisma
- Add `helmet`, `cors`, `morgan`
- Add rate limiting
- Add `dotenv`
- Add `/health` endpoint
- Add `vitest.config.ts`

## Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma
RUN npx prisma generate
COPY dist ./dist
EXPOSE 3004
CMD ["node", "dist/app.js"]
```

## docker-compose.yml
```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: logistics
      POSTGRES_PASSWORD: logistics
      POSTGRES_DB: logistics
    ports:
      - "5432:5432"
  api:
    build: .
    ports:
      - "3004:3004"
    environment:
      DATABASE_URL: postgresql://logistics:logistics@db:5432/logistics
      NODE_ENV: production
    depends_on:
      - db
```

## Prisma Schema (excerpt)
```prisma
model Shipment {
  id              String         @id @default(uuid())
  trackingNumber  String         @unique
  status          ShipmentStatus @default(CREATED)
  originId        String
  destinationId   String
  weight          Float
  createdBy       String
  origin          Warehouse      @relation("Origin", fields: [originId], references: [id])
  destination     Warehouse      @relation("Destination", fields: [destinationId], references: [id])
  tracking        Tracking[]
  route           Route?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

model Tracking {
  id          String   @id @default(uuid())
  shipmentId  String
  status      ShipmentStatus
  notes       String?
  createdAt   DateTime @default(now())
  shipment    Shipment @relation(fields: [shipmentId], references: [id])
}

model Warehouse {
  id        String     @id @default(uuid())
  name      String
  address   String
  latitude  Float
  longitude Float
  inventory Inventory[]
  origin    Shipment[] @relation("Origin")
  dest      Shipment[] @relation("Destination")
}
```

## app.ts Production Additions
```typescript
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
}));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

## Benefits
- PostgreSQL + Prisma transactions fix status/tracking inconsistency
- Docker reproducibility across environments
- Rate limiting prevents tracking-number enumeration
- Health check enables orchestration

## Final State
This matches the current codebase in `MD20-logistics/`.
