# Build Guide: From Empty Folder

## 1. Bootstrap

```bash
mkdir E07-autoscaling-platform && cd E07-autoscaling-platform
npm init -y
npm install express@^5.0.0 zod
npm install -D typescript vitest tsx @types/express @types/supertest supertest
```

## 2. Configure TypeScript (ESM)

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## 3. Add Scripts to package.json

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

## 4. Folder Structure

```
src/
  types/
  services/
  controllers/
  routes/
  utils/
tests/
  unit/
  integration/
  bug-repro/
docs/
```

## 5. Implement Types (`src/types/index.ts`)

Define `Metric`, `Workload`, `ScalingRule`, `Node`, `ScalingDecision`, etc.

## 6. Implement Metrics Service

In-memory store, sliding window average.

## 7. Implement Scaling Service (Bug)

Single threshold evaluator (`evaluateScaling`). This is the intentionally broken version.

## 8. Implement Cooldown Manager

Track `lastScaleTime` per workload.

## 9. Implement Predictive Scaling Stub

Simple moving average and linear regression functions.

## 10. Implement Cost Optimizer

First-Fit Decreasing bin-packing algorithm.

## 11. Implement Routes & Controllers

Express routers for `/metrics`, `/scaling`, `/optimize`.

## 12. Write Unit Tests

Test each service independently.

## 13. Reproduce the Bug

Write `tests/bug-repro/flapping.test.ts`: alternate metrics around 50% and observe `scale_up` / `scale_down` oscillation.

## 14. Fix with Hysteresis

Create `src/services/hysteresisService.ts` with dual thresholds (deadband).

## 15. Verify Fix

Update bug-repro test to show the fixed path no longer flaps.

## 16. Integration Tests

Use `supertest` to exercise the full HTTP surface.

## 17. Docker Compose

```yaml
services:
  api:
    image: node:20-alpine
    working_dir: /app
    volumes: [".: /app"]
    ports: ["3007:3000"]
    command: sh -c "npm install && npm run dev"
  prometheus:
    image: prom/prometheus:v2.55.0
    ports: ["9090:9090"]
```

## 18. Run Everything

```bash
npm run test
npm run dev
```
