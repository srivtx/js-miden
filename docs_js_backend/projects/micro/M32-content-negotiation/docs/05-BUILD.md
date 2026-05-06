# M32: Step-by-Step Build

## 1. Empty folder
```bash
mkdir m32-content-negotiation && cd m32-content-negotiation
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
- `src/negotiator.ts` - Accept header parser + format selector
- `src/formatters.ts` - JSON/XML/HTML/Text formatters
- `src/index.ts` - Express app with `res.negotiate()`

## 5. Create tests
- `tests/negotiation.test.ts` - Test each format + wildcard bug

## 6. Run
```bash
npm run dev
npm test
```
