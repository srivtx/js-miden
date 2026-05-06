# A05: IoT Device Manager - Telemetry

## Overview

Telemetry is the core data stream of the IoT system. Devices periodically send environmental readings (temperature and humidity) which are stored and analyzed.

## Data Model

```typescript
interface TelemetryReading {
  id: string;
  deviceId: string;
  temperature: number;  // Celsius
  humidity: number;     // Percentage (0-100)
  timestamp: number;    // Device-reported time
  receivedAt: number;   // Server-reported time
}
```

## Ingestion Flow

1. Device sends `POST /telemetry` with reading
2. Server validates payload (temperature and humidity must be numbers)
3. Reading is stored in time-series storage
4. Alert engine checks reading against thresholds
5. Any generated alerts are returned in the response

## Time-Series Storage

### Phase 1: In-Memory
- Simple array storage
- Fast for small-scale testing
- No persistence across restarts

### Phase 2-3: Production Storage

#### Option 1: InfluxDB
- Purpose-built for time-series data
- Efficient compression and querying
- Supports retention policies

#### Option 2: TimescaleDB
- PostgreSQL extension
- SQL interface with time-series optimizations
- Good for complex analytical queries

#### Option 3: Redis Streams
- In-memory with optional persistence
- Pub/sub for real-time consumers
- Good for high-throughput ingestion

## Rate Limiting

### Known Bug

**No Rate Limiting**: Devices can submit telemetry as fast as they want. A compromised or malfunctioning device could send 10,000 readings per second, causing:
- Memory exhaustion (DoS)
- Storage overflow
- Alert spam

### Recommended Fix

Implement per-device rate limiting:

```typescript
// Token bucket or sliding window rate limiter
const limiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 60, // 60 readings per minute per device
});
```

## Validation

- Temperature: numeric, expected range -40°C to 80°C
- Humidity: numeric, expected range 0% to 100%
- Reject malformed payloads with 400 Bad Request
