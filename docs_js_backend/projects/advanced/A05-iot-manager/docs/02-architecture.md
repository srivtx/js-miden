# A05: IoT Device Manager - Architecture

## System Architecture

```
┌─────────────┐     HTTP/MQTT     ┌─────────────────────┐
│ IoT Devices │ ◄───────────────► │  IoT Device Manager │
└─────────────┘                   │  (Express 5 + TS)   │
                                  └─────────────────────┘
                                           │
          ┌────────────────────────────────┼────────────────────────────────┐
          │                                │                                │
   ┌──────▼──────┐                ┌───────▼────────┐            ┌──────────▼─────────┐
   │  Telemetry  │                │   Heartbeat    │            │     Commands       │
   │   Storage   │                │   Monitor      │            │      Queue         │
   └─────────────┘                └────────────────┘            └────────────────────┘
```

## Component Design

### Device Layer
- Manages device lifecycle (register, update, query)
- Stores device metadata and authentication tokens

### Telemetry Layer
- Validates incoming telemetry payloads
- Stores time-series data (temperature, humidity)
- Triggers alert checks on each reading

### Heartbeat Layer
- Receives periodic heartbeats from devices
- Background job marks devices offline after 5 minutes of inactivity
- **Known Issue**: Race condition between heartbeat update and offline check

### Alert Layer
- Threshold-based alerting (temperature > 35°C warning, > 45°C critical)
- Humidity alerts for values outside 20-80% range
- Alert acknowledgment workflow

### Command Layer
- Command queue with states: pending → sent → acknowledged
- Devices poll for pending commands

## Data Flow

1. Device registers → receives ID + auth token
2. Device sends telemetry → stored + alerts checked
3. Device sends heartbeat → lastSeen updated
4. Background monitor → marks stale devices offline
5. Operator sends command → device polls and acknowledges

## Phase 2-3 Considerations

- **MQTT vs HTTP**: MQTT is better for IoT (pub/sub, lower overhead, persistent connections). HTTP is simpler for prototyping.
- **Time-Series DB**: In production, use InfluxDB or TimescaleDB instead of in-memory storage
- **Distributed Heartbeat**: Use Redis with TTL keys or a proper job scheduler (BullMQ)
