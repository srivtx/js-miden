# 05-BUILD

## Step-by-Step

1. **Initialize project**
   ```bash
   npm init -y
   npm install express@5 bullmq ioredis nodemailer sharp
   npm install -D typescript @types/express @types/nodemailer @types/node supertest @types/supertest vitest tsx
   npx tsc --init
   ```

2. **Configure TypeScript ESM**
   Set `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`.

3. **Set up BullMQ**
   - `src/services/queue.ts`: Create `Queue`, `Worker`, and `deadLetterQueue`.
   - Configure retries and exponential backoff.

4. **Create processors**
   - `src/services/processors.ts`: `emailProcessor`, `imageProcessor`, `exportProcessor`.

5. **Create controller**
   - `src/controller.ts`: `enqueueJob`, `getJobStatus`, `cancelJob`.

6. **Wire routes**
   - `src/routes.ts`: POST `/jobs`, GET `/jobs/:id`, DELETE `/jobs/:id`.

7. **Create app entry**
   - `src/index.ts`: Express with JSON and error handler.

8. **Write tests**
    - `tests/queue.test.ts`: Enqueue, status check, timeout bug reproduction.

9. **Add Docker**
    - `docker-compose.yml`: Redis.

10. **Run worker**
    - In production, run worker in a separate process or container.
