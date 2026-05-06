# M33: Step-by-Step Build

## 1. Empty folder
```bash
mkdir m33-uuid-service && cd m33-uuid-service
npm init -y
```

## 2. Install dependencies
```bash
npm install express
npm install -D typescript @types/express @types/node vitest supertest @types/supertest tsx
```

## 3. Configure TypeScript
Same ESM config as M31.

## 4. Create source files
- `src/uuid.ts` - v4, v7, ULID generators
- `src/index.ts` - Express routes

## 5. Create tests
- `tests/uuid.test.ts` - Validate format, test bulk, reproduce timestamp bug

## 6. Run
```bash
npm run dev
npm test
```
