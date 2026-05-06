# E07 Autoscaling Platform

Expert-level auto-scaling platform controller. Collects metrics, applies threshold rules with cooldown, provides predictive scaling stubs, and optimizes cost via bin packing.

## Bug

Flapping — scales up then immediately scales down in oscillation because hysteresis is not implemented. See `tests/bug-repro/flapping.test.ts` for reproduction and `src/services/hysteresisService.ts` for the fix.

## Architecture

- `src/routes/metrics.ts` — Metrics ingestion & retrieval
- `src/routes/scaling.ts` — Scaling rules, workloads, evaluation
- `src/routes/optimizer.ts` — Cost optimization (bin packing)
- `src/services/metricsService.ts` — In-memory metrics store
- `src/services/scalingService.ts` — Buggy single-threshold scaler
- `src/services/hysteresisService.ts` — Fixed dual-threshold scaler
- `src/services/cooldownManager.ts` — Cooldown state machine
- `src/services/predictiveScaling.ts` — Time-series forecasting stub
- `src/services/costOptimizer.ts` — First-Fit Decreasing bin packing
- `src/controllers/` — Express controllers
- `tests/` — Vitest unit, integration, and bug-reproduction suites

## Scripts

- `npm run dev` — development with hot reload
- `npm run build` — compile TypeScript
- `npm run start` — run production build
- `npm run test` — run Vitest suite

## Docs

See the `docs/` folder for deep dives into control theory, design decisions, real-world incidents, and a senior engineer critique.
