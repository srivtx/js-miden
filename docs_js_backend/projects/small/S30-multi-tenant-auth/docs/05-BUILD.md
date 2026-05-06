# 05-BUILD

## Step-by-Step

1. **Initialize project**
   ```bash
   npm init -y
   npm install express@5 pg jsonwebtoken bcryptjs helmet express-rate-limit
   npm install -D typescript @types/express @types/pg @types/jsonwebtoken @types/bcryptjs @types/node supertest @types/supertest vitest tsx
   npx tsc --init
   ```

2. **Configure TypeScript ESM**
   Set `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`.

3. **Set up database**
   - `src/db.ts`: PostgreSQL pool. Create schemas `tenant_a` and `tenant_b` with `users` tables.

4. **Create tenant service**
   - `src/services/tenant.ts`: Resolve tenant from header or subdomain.

5. **Create auth service**
   - `src/services/auth.ts`: Register, login, JWT generation. Include `tenantId` claim.

6. **Create middleware**
   - `src/middleware.ts`: `authenticate` verifies JWT. `requireTenant` resolves tenant. Bug: does not validate claim against request.

7. **Create controller**
   - `src/controller.ts`: `register`, `login`, `getProfile`.

8. **Wire routes**
   - `src/routes.ts`: POST `/register`, POST `/login`, GET `/profile` with middleware.

9. **Create app entry**
   - `src/index.ts`: Express with JSON, helmet, rate limit.

10. **Write tests**
    - `tests/auth.test.ts`: Register, login, cross-tenant access bug reproduction.

11. **Add Docker**
    - `docker-compose.yml`: PostgreSQL with init script.
