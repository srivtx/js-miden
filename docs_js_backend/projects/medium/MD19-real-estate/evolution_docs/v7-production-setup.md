# MD19 Real Estate — v7 Production Setup

## Goal
Deploy the real estate API with PostgreSQL, Docker, and production hardening.

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
EXPOSE 3003
CMD ["node", "dist/app.js"]
```

## docker-compose.yml
```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: realestate
      POSTGRES_PASSWORD: realestate
      POSTGRES_DB: realestate
    ports:
      - "5432:5432"
  api:
    build: .
    ports:
      - "3003:3003"
    environment:
      DATABASE_URL: postgresql://realestate:realestate@db:5432/realestate
      NODE_ENV: production
    depends_on:
      - db
```

## Prisma Schema (excerpt)
```prisma
model Listing {
  id            String   @id @default(uuid())
  address       String
  city          String
  state         String
  zipCode       String
  price         Decimal  @db.Decimal(12, 2)
  beds          Int
  baths         Float
  propertyType  String
  status        String   @default("ACTIVE")
  latitude      Float
  longitude     Float
  tours         Tour[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Tour {
  id          String   @id @default(uuid())
  listingId   String
  userId      String
  scheduledAt DateTime
  status      String   @default("SCHEDULED")
  listing     Listing  @relation(fields: [listingId], references: [id])
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
- PostgreSQL enables PostGIS extension for geospatial search
- Docker reproducibility across environments
- Rate limiting prevents scraping
- Health check enables orchestration

## Final State
This matches the current codebase in `MD19-real-estate/`.
