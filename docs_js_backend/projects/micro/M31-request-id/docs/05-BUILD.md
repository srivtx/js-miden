# M31: Step-by-Step Build

## 1. Empty folder
```bash
mkdir m31-request-id && cd m31-request-id
npm init -y
```

## 2. Install dependencies
```bash
npm install express
npm install -D typescript @types/express @types/node vitest supertest @types/supertest tsx
```

## 3. Configure TypeScript
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true
  }
}
```

## 4. Create source files
- `src/requestId.ts` - UUID generation + middleware
- `src/logger.ts` - Structured logging with request ID
- `src/proxy.ts` - Downstream propagation
- `src/index.ts` - Express app

## 5. Create tests
- `tests/requestId.test.ts` - Vitest + supertest

## 6. Run
```bash
npm run dev
npm test
```
