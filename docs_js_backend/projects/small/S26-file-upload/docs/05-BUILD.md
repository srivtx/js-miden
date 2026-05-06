# 05-BUILD

## Step-by-Step

1. **Initialize project**
   ```bash
   npm init -y
   npm install express@5 multer sharp @aws-sdk/client-s3 file-type helmet express-rate-limit
   npm install -D typescript @types/express @types/multer @types/node supertest @types/supertest vitest tsx
   npx tsc --init
   ```

2. **Configure TypeScript ESM**
   Set `"module": "NodeNext"`, `"moduleResolution": "NodeNext"` in `tsconfig.json`.

3. **Create storage abstraction**
   - `src/services/storage.ts`: Define `Storage` interface.
   - Implement `LocalStorage` and `S3Storage`.

4. **Add image processing service**
   - `src/services/image.ts`: Use `sharp` for thumbnails and watermarks.

5. **Add virus scanning stub**
   - `src/services/scan.ts`: Return `{ clean: true }` for now; leave interface ready.

6. **Create middleware**
   - `src/middleware.ts`: Use `fileTypeFromFile` to validate magic numbers against a whitelist.

7. **Create controller**
   - `src/controller.ts`: `uploadFile` runs scan, stores file, and conditionally processes images.

8. **Wire routes**
   - `src/routes.ts`: Multer single-file upload -> middleware -> controller.

9. **Create app entry**
   - `src/index.ts`: Express with helmet, rate limit, error handler.

10. **Write tests**
    - `tests/upload.test.ts`: Valid upload, invalid magic number, path traversal bug reproduction.

11. **Add Docker**
    - `docker-compose.yml`: MinIO for S3-compatible local storage.
