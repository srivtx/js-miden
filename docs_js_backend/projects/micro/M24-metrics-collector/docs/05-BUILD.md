# BUILD: Metrics Collector

## Step-by-Step from Empty Folder

### Step 0: Create Project Directory

```bash
mkdir M24-metrics-collector
cd M24-metrics-collector
npm init -y
```

### Step 1: Install Dependencies

```bash
npm install express@^5.0.0
npm install -D typescript@^5.4.0 @types/node@^20.0.0 @types/express@^5.0.0 \
  jest@^29.7.0 @types/jest@^29.5.0 ts-jest@^29.1.0 supertest@^7.0.0 \
  @types/supertest@^6.0.0
```

### Step 2: Configure TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Step 3: Configure Jest

```javascript
// jest.config.js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testTimeout: 10000,
};
```

### Step 4: Create the Metrics Collector Core

```typescript
// src/metrics-collector.ts

export interface MetricRecord {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}

export interface AggregatedMetrics {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
}

export class MetricsCollector {
  private metrics: Map<string, MetricRecord[]> = new Map();

  record(name: string, value: number, tags: Record<string, string> = {}): void {
    const record: MetricRecord = {
      name,
      value,
      tags,
      timestamp: Date.now(),
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(record);
  }

  getMetrics(name: string, windowMs?: number): AggregatedMetrics | null {
    // BUG: No time window filtering - returns ALL historical data
    // const cutoff = windowMs ? Date.now() - windowMs : 0;
    let records = this.metrics.get(name) || [];

    // Should filter by time window but doesn't:
    // records = records.filter(r => r.timestamp > cutoff);

    if (records.length === 0) return null;

    const values = records.map(r => r.value).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / count;
    const min = values[0];
    const max = values[count - 1];
    const p95 = this.percentile(values, 0.95);
    const p99 = this.percentile(values, 0.99);

    return { count, sum, avg, min, max, p95, p99 };
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }

  getAllMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  getRawMetrics(name: string): MetricRecord[] {
    return this.metrics.get(name) || [];
  }
}
```

**Key design choices explained:**
- `Map<string, MetricRecord[]>`: Groups records by metric name for fast lookup
- `Date.now()`: Uses local system time for timestamps
- `.sort((a, b) => a - b)`: Numeric sort required for correct percentile calculation
- `Math.ceil(sortedValues.length * p) - 1`: Standard percentile index formula

### Step 5: Create the Express Server

```typescript
// src/index.ts
import express from 'express';
import { MetricsCollector } from './metrics-collector.js';

const app = express();
app.use(express.json());

const collector = new MetricsCollector();

app.post('/metrics', (req, res) => {
  const { name, value, tags } = req.body;

  if (!name || typeof value !== 'number') {
    res.status(400).json({ error: 'Name and numeric value required' });
    return;
  }

  collector.record(name, value, tags || {});
  res.status(201).json({ recorded: true });
});

app.get('/metrics/:name', (req, res) => {
  const { name } = req.params;
  const windowMs = req.query.windowMs ? parseInt(req.query.windowMs as string) : undefined;
  const metrics = collector.getMetrics(name, windowMs);

  if (!metrics) {
    res.status(404).json({ error: 'No metrics found' });
    return;
  }

  res.json({ name, ...metrics });
});

app.get('/metrics', (req, res) => {
  const names = collector.getAllMetricNames();
  const all: Record<string, any> = {};
  for (const name of names) {
    all[name] = collector.getMetrics(name);
  }
  res.json({ metrics: all });
});

export { app, collector };

if (import.meta.url === `file://${process.argv[1]}`) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Metrics collector service running on port ${PORT}`);
  });
}
```

**Route design explained:**
- `POST /metrics`: Record a new metric value
- `GET /metrics/:name`: Get aggregated statistics for a metric
- `GET /metrics`: Get all metrics (useful for dashboards)

### Step 6: Write Tests

```typescript
// tests/metrics-collector.test.ts
import request from 'supertest';
import { app, collector } from '../src/index.js';

describe('Metrics Collector', () => {
  beforeEach(() => {
    (collector as any).metrics = new Map();
  });

  it('should record metrics', async () => {
    await request(app)
      .post('/metrics')
      .send({ name: 'response_time', value: 150, tags: { endpoint: '/api' } });

    const res = await request(app).get('/metrics/response_time');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });

  it('should return 404 for unknown metrics', async () => {
    const res = await request(app).get('/metrics/unknown');
    expect(res.status).toBe(404);
  });

  it('should calculate correct statistics', async () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    for (const value of values) {
      await request(app)
        .post('/metrics')
        .send({ name: 'latency', value });
    }

    const res = await request(app).get('/metrics/latency');
    expect(res.body.count).toBe(10);
    expect(res.body.avg).toBe(55);
    expect(res.body.min).toBe(10);
    expect(res.body.max).toBe(100);
    expect(res.body.p95).toBeGreaterThanOrEqual(90);
    expect(res.body.p99).toBeGreaterThanOrEqual(95);
  });

  it('should filter metrics by time window', async () => {
    await request(app)
      .post('/metrics')
      .send({ name: 'requests', value: 1 });

    await new Promise(r => setTimeout(r, 200));

    await request(app)
      .post('/metrics')
      .send({ name: 'requests', value: 2 });

    const res = await request(app).get('/metrics/requests?windowMs=100');

    // BUG: No time window means all historical data returned
    expect(res.body.count).toBe(1);
    expect(res.body.sum).toBe(2);
  });

  it('should prevent unbounded memory growth', async () => {
    for (let i = 0; i < 100; i++) {
      await request(app)
        .post('/metrics')
        .send({ name: 'growth_test', value: i });
    }

    const res = await request(app).get('/metrics/growth_test?windowMs=1');
    expect(res.body.count).toBeLessThan(100);
  });
});
```

### Step 7: Run and Verify

```bash
npm run build
npm test
npm start
```

**Expected test results:** `should filter metrics by time window` and `should prevent unbounded memory growth` will fail due to the intentional bug.
