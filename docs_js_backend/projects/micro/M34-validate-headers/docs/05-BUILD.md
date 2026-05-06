# M34: Step-by-Step Build

## 1. Empty folder
```bash
mkdir m34-validate-headers && cd m34-validate-headers
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
- `src/validator.ts` - Header validation rules + middleware
- `src/index.ts` - Express app with strict/lenient routes

## 5. Create tests
- `tests/validator.test.ts` - Test valid, invalid, case-sensitivity bug

## 6. Run
```bash
npm run dev
npm test
```
