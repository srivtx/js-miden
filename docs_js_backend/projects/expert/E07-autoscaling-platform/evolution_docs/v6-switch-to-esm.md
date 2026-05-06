# v6 — Switch to ESM

Your autoscaling platform has tests, but CommonJS is limiting your metrics collection and scaling algorithms. Modern time-series libraries and math libraries are ESM-first.

## Pain #1: Time-Series Forecasting Libraries

```javascript
// CommonJS
const { simpleMovingAverage } = require('technicalindicators');
// technicalindicators v4+ is ESM-only.
// You want to use it for predictive scaling.
```

You write your own moving average implementation. It's buggy. Predictions are wrong. You can't use battle-tested libraries.

## Pain #2: Math and Statistics

```javascript
// CommonJS
const math = require('mathjs');
// mathjs v12+ is ESM-only.
// You need it for standard deviation, regression, and optimization.
```

Your cost optimizer uses hand-rolled math. Floating-point errors accumulate. Bin packing decisions are suboptimal.

## Pain #3: Config Loading at Startup

```javascript
// CommonJS
const config = require('./config');
// Config needs to load from etcd/consul asynchronously.
// require() is synchronous. You defer to first request.
```

The first scaling evaluation after startup uses default config. It might make wrong decisions for 30 seconds until config loads.

## The Fix: ESM Migration

### package.json

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest",
    "start": "node dist/index.js"
  }
}
```

### Source Files

```typescript
// src/services/predictiveScaling.ts
import { simpleMovingAverage } from 'technicalindicators';
import { linearRegression } from 'ml-regression-simple-linear';
import { logger } from '../utils/logger.js';
import type { MetricPoint, ScalingDecision } from '../types/index.js';

export function predictFutureLoad(
  metrics: MetricPoint[],
  horizonMinutes: number
): number {
  const values = metrics.map(m => m.value);
  const sma = simpleMovingAverage({ values, period: 10 });
  
  // Linear regression on recent points
  const recent = metrics.slice(-20);
  const x = recent.map((_, i) => i);
  const y = recent.map(m => m.value);
  const regression = new linearRegression(x, y);
  
  const predicted = regression.predict(recent.length + horizonMinutes);
  logger.info({ predicted, current: values[values.length - 1] }, 'Load prediction');
  
  return Math.max(0, predicted);
}
```

```typescript
// src/services/costOptimizer.ts
import { logger } from '../utils/logger.js';
import type { Workload, Node, AllocationPlan } from '../types/index.js';

export function firstFitDecreasing(workloads: Workload[], nodes: Node[]): AllocationPlan {
  const sorted = [...workloads].sort((a, b) => b.cpuRequest - a.cpuRequest);
  // ...
}

export function optimizeWithLinearProgramming(workloads: Workload[], nodes: Node[]): AllocationPlan {
  // ESM-only optimization library
  // import { solve } from 'yalps';
  // ...
}
```

```typescript
// src/index.ts
import express from 'express';
import { loadConfig } from './config.js';
import { logger } from './utils/logger.js';

const app = express();

// Top-level await for config
const config = await loadConfig();
logger.info({ config }, 'Configuration loaded');

// Pre-load metrics history
const metricsHistory = await loadMetricsHistory();
logger.info({ count: metricsHistory.length }, 'Metrics history loaded');

app.listen(config.port, () => {
  logger.info(`Autoscaling platform on port ${config.port}`);
});
```

## What Changed

1. **Time-series forecasting** — Moving averages, regression, prediction.
2. **Math accuracy** — Standard libraries instead of hand-rolled code.
3. **Startup initialization** — Config and history load before accepting requests.
4. **Optimization libraries** — Linear programming for advanced bin packing.

## ESM for Control Systems

In autoscaling, math correctness is critical. ESM gives you:
- **Latest math libraries** — No floating-point bugs from hand-rolled code
- **Time-series analysis** — Proven forecasting algorithms
- **Async initialization** — Config loads before the first evaluation
- **Optimization tools** — Linear programming, genetic algorithms

## Next Pain

The platform runs but has no graceful shutdown. Active scaling decisions are dropped. Metrics are lost. You need production setup.
