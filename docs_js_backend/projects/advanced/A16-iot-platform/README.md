# A16 IoT Platform

IoT device management platform with MQTT broker integration, telemetry ingestion, time-series storage, device commands, and alerting rules engine.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Device    │────▶│   Mosquitto  │────▶│  MQTT Bridge    │
│  (Sensor)   │     │  MQTT Broker │     │  (Express)      │
└─────────────┘     └──────────────┘     └─────────────────┘
       │                     ▲                       │
       │ Commands            │ OTA                   ▼
       ▼                     │              ┌─────────────────┐
┌─────────────┐     ┌──────────────┐       │  Telemetry      │
│   Device    │◀────│  Command     │◀──────│  Ingestion      │
│  (Actuator) │     │  Queue       │       │  Service        │
└─────────────┘     └──────────────┘       └─────────────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │  InfluxDB /     │
                                          │  TimescaleDB    │
                                          └─────────────────┘
                                                   │
                                                   ▼
                                          ┌─────────────────┐
                                          │  Rules Engine   │
                                          │  & Alerting     │
                                          └─────────────────┘
```

## Features

- **Device Registration**: Onboarding and metadata management
- **MQTT Broker**: Mosquitto integration with topic patterns
- **Telemetry Ingestion**: High-throughput message processing
- **Time-Series Storage**: InfluxDB/TimescaleDB integration points
- **Device Commands**: OTA updates and remote configuration
- **Alerting Rules**: Threshold-based and anomaly detection

## Tech Stack

- Express 5 (ESM)
- TypeScript
- Vitest + Supertest
- MQTT.js (client/bridge)
- Winston (logging)

## Known Bugs

1. **No Device Authentication**: The MQTT bridge and HTTP ingestion endpoints accept any `deviceId` without cryptographic verification, allowing spoofing.

## Getting Started

```bash
npm install
npm run dev
```

## Testing

```bash
npm test
```

## Docker

```bash
docker-compose up -d
```
