# M35: Step-by-Step Build

## 1. Empty folder
```bash
mkdir m35-timezone-api && cd m35-timezone-api
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
- `src/timezone.ts` - Conversion logic + fixed offset map
- `src/index.ts` - Express routes

## 5. Create tests
- `tests/timezone.test.ts` - Test conversion, list, DST bug

## 6. Run
```bash
npm run dev
npm test
```
