# MD16 Food Delivery — v7 Production Setup

## Goal
Make the API deployable, observable, and resilient in production.

## Changes from v6
- Add `Dockerfile` + `docker-compose.yml`
- Switch from SQLite to PostgreSQL via Prisma
- Add `helmet`, `cors`, `morgan` middleware
- Add rate limiting (`express-rate-limit`)
- Add `dotenv` for environment config
- Add `npm run db:seed` for seed data
- Add health check endpoint (`/health`)
- Add `vitest.config.ts` with coverage

## Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma
RUN npx prisma generate
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/app.js"]
```

## docker-compose.yml
```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: fooddev
      POSTGRES_PASSWORD: fooddev
      POSTGRES_DB: fooddelivery
    ports:
      - "5432:5432"
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://fooddev:fooddev@db:5432/fooddelivery
      NODE_ENV: production
    depends_on:
      - db
```

## Prisma Schema (excerpt)
```prisma
model Order {
  id           String      @id @default(uuid())
  customerId   String
  restaurantId String
  driverId     String?
  status       OrderStatus @default(PLACED)
  total        Decimal     @db.Decimal(10, 2)
  address      String
  latitude     Float
  longitude    Float
  items        OrderItem[]
  tracking     Tracking[]
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
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
- PostgreSQL handles concurrent driver assignments better than SQLite
- Prisma transactions (`$transaction`) can fix the race condition
- Docker image is reproducible across dev / staging / prod
- Rate limiting prevents brute-force on assignment endpoints
- Health check enables load balancer readiness probes

## Final State
This matches the current codebase in `MD16-food-delivery/`.
