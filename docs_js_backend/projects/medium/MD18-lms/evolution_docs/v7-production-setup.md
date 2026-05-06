# MD18 LMS — v7 Production Setup

## Goal
Deploy the LMS with PostgreSQL, Docker, and production hardening.

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
EXPOSE 3002
CMD ["node", "dist/app.js"]
```

## docker-compose.yml
```yaml
version: '3.8'
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: lms
      POSTGRES_PASSWORD: lms
      POSTGRES_DB: lms
    ports:
      - "5432:5432"
  api:
    build: .
    ports:
      - "3002:3002"
    environment:
      DATABASE_URL: postgresql://lms:lms@db:5432/lms
      NODE_ENV: production
    depends_on:
      - db
```

## Prisma Schema (excerpt)
```prisma
model Course {
  id          String        @id @default(uuid())
  title       String
  description String?
  instructorId String
  maxStudents Int
  lessons     Lesson[]
  enrollments Enrollment[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model Enrollment {
  id        String   @id @default(uuid())
  userId    String
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id])
  progress  Progress?
  enrolledAt DateTime @default(now())
  @@unique([userId, courseId])
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
- PostgreSQL + Prisma transactions fix enrollment race
- Docker reproducibility across environments
- Rate limiting prevents brute-force enrollment
- Health check enables orchestration

## Final State
This matches the current codebase in `MD18-lms/`.
