# M24: Metrics Collector

A metrics collector with aggregation and percentile support and intentional bugs to fix.

## Quick Start

```bash
npm install
npm test          # See failing tests
npm run build
npm start
```

## API

- `POST /metrics` - Record a metric
- `GET /metrics/:name` - Get aggregated metrics
- `GET /metrics` - Get all metrics

## Phases

### Phase 1: Basic Metrics Collection
Build a system that:
- Records metrics with name, value, and tags
- Returns aggregated data (count, avg, p95, p99)
- Supports multiple metric names

### Phase 2-3: Advanced Concepts
- Time-series data storage
- Aggregation windows
- Histograms vs summaries
- Memory management
- High-cardinality tags

## Bugs

### Bug 1: No Time Window
Returns all historical data instead of filtering by time window, causing unbounded memory growth.

### Bug 2: Average Calculation Wrong
The sum/count calculation can overflow with large numbers or long-running systems.

## Docs

See the `docs/` folder for complete documentation.
