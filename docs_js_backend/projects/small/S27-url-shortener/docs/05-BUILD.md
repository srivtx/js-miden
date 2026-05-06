# 05-BUILD

## Step-by-Step

1. **Initialize project**
   ```bash
   npm init -y
   npm install express@5 pg redis helmet express-rate-limit nanoid
   npm install -D typescript @types/express @types/pg @types/node supertest @types/supertest vitest tsx
   npx tsc --init
   ```

2. **Configure TypeScript ESM**
   Set `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`.

3. **Set up database**
   - `src/db.ts`: PostgreSQL pool with `urls` and `clicks` tables.

4. **Create shortener service**
   - `src/services/shortener.ts`: Generate short codes. For the bug, use a sequential counter.

5. **Create analytics service**
   - `src/services/analytics.ts`: Aggregate clicks and referrers.

6. **Create controller**
   - `src/controller.ts`: `createShortUrl`, `redirectShortUrl`, `getAnalytics`.

7. **Wire routes**
   - `src/routes.ts`: POST `/shorten` with rate limiter, GET `/:shortCode`, GET `/:shortCode/stats`.

8. **Create app entry**
   - `src/index.ts`: Express with JSON, helmet, rate limit.

9. **Write tests**
    - `tests/shortener.test.ts`: Create URL, custom code, sequential bug reproduction.

10. **Add Docker**
    - `docker-compose.yml`: PostgreSQL and Redis.
