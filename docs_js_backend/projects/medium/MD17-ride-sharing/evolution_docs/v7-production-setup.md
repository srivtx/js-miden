# MD17 Ride Sharing — v7 Production Setup

## Goal
Deploy the ride-sharing API with PostgreSQL, Docker, and production hardening.

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
EXPOSE 3001
CMD ["node", "dist/app.js"]
```

## docker-compose.yml
```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: rideshare
      POSTGRES_PASSWORD: rideshare
      POSTGRES_DB: rideshare
    ports:
      - "5432:5432"
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://rideshare:rideshare@db:5432/rideshare
      NODE_ENV: production
    depends_on:
      - db
```

## Prisma Schema (excerpt)
```prisma
model Ride {
  id              String     @id @default(uuid())
  riderId         String
  driverId        String?
  status          RideStatus @default(REQUESTED)
  pickupAddress   String
  pickupLat       Float
  pickupLng       Float
  dropoffAddress  String
  dropoffLat      Float
  dropoffLng      Float
  baseFare        Float
  distanceFare    Float
  timeFare        Float
  surgeMultiplier Float      @default(1.0)
  totalFare       Float
  distanceKm      Float
  estimatedMinutes Int
  actualMinutes   Int?
  review          Review?
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
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
- PostgreSQL + Prisma transactions can fix surge-pricing race
- Docker image reproducible across environments
- Rate limiting prevents abuse on fare endpoints
- Health check enables load-balancer integration

## Final State
This matches the current codebase in `MD17-ride-sharing/`.
