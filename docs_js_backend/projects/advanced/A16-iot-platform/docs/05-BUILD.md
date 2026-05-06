# Build & Run

## Prerequisites

- Node.js >= 20
- Docker & Docker Compose

## Local Development

```bash
cd A16-iot-platform
npm install
npm run dev
```

The server connects to Mosquitto on startup.

## Running Tests

```bash
npm test
```

Tests cover:
- Device CRUD
- Telemetry ingestion (including spoofing bug)
- Alert rule evaluation

## Docker

```bash
docker-compose up -d
```

Services:
- `app`: Express server + MQTT bridge
- `mosquitto`: MQTT broker (port 1883)
- `influxdb`: Time-series database (port 8086)
- `redis`: Cache and state store
- `ota-server`: Firmware distribution

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| MQTT_BROKER_URL | mqtt://localhost:1883 | MQTT connection |
| INFLUXDB_URL | http://localhost:8086 | Time-series DB |
| INFLUXDB_TOKEN | iot-token | InfluxDB auth token |
| REDIS_URL | redis://localhost:6379 | Redis connection |

## Project Structure

```
src/
  index.ts              # Entry point, starts MQTT bridge
  config.ts             # Configuration
  routes/               # HTTP routers
  controllers/          # HTTP handlers
  services/             # Business logic (device, telemetry, MQTT, alerts)
  middleware/           # Auth (bug: missing), validation, errors
  types/                # TypeScript interfaces
  utils/                # MQTT helpers, rule engine
tests/                  # Vitest test suite
docs/                   # Documentation
```
