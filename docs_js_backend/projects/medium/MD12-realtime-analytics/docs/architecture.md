# Architecture

## Overview

Real-time analytics platform with event ingestion, Redis aggregation, time-series storage, and dashboard API.

## System Architecture

```
┌──────────────┐
│ Event Sources │
└──────┬───────┘
       │ POST /events
       ▼
┌─────────────────────┐
│  Ingestion API      │
│  - Validation       │
│  - Rate Limiting    │
└────────┬────────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌────────┐
│PostgreSQL│ │ Redis  │
│ (events) │ │(aggregates)│
└───────┘  └────────┘
         │
         ▼
┌─────────────────────┐
│  Aggregation Engine │
│  - Windowing        │
│  - Rollups          │
│  - Backpressure     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Dashboard API      │
│  GET /metrics       │
└─────────────────────┘
```

## Event Flow

1. **Ingestion**: Events validated and stored in PostgreSQL
2. **Aggregation**: Redis counters updated (with race condition bug)
3. **Windowing**: Events grouped into tumbling windows
4. **Query**: Dashboard reads aggregated data

## Windowing Strategies

### Tumbling Windows
Non-overlapping, fixed-size windows.
```
Time:  [0-60s)[60-120s)[120-180s)
Window:   W1       W2        W3
```

### Sliding Windows
Overlapping windows that slide by a step size.
```
Time:  [0-60s)[30-90s)[60-120s)
Window:   W1       W2       W3
```

### Session Windows
Dynamic windows based on user activity gaps.
```
Time:  [0-45s)  [120-180s)
Window:  S1         S2
         (gap > 60s)
```

## Key Components

### Event Ingestion
- Batch processing support
- Input validation with Zod
- Rate limiting

### Aggregation Engine
- Window key generation
- Redis counter updates
- Backpressure handling

### Dashboard API
- Real-time metrics
- Time-series queries
- Historical data

## Known Issues

### Race Condition in Aggregation
Multiple concurrent events can read the same counter value, increment it, and write back - losing updates.

### No Window Cleanup
Old window data is never purged, leading to unbounded storage growth.

## Research Citations

1. Akidau, T. (2015). "The World Beyond Batch: Streaming 101". O'Reilly.
2. Carbone, P. et al. (2015). "Apache Flink: Stream and Batch Processing". IEEE.
3. Zaharia, M. et al. (2013). "Discretized Streams: Fault-Tolerant Streaming Computation at Scale". SOSP.
4. Kleppmann, M. (2017). "Designing Data-Intensive Applications". O'Reilly.
5. Apache Kafka Documentation: https://kafka.apache.org/documentation/