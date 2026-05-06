# Thinking Process

## IoT Architecture Patterns

IoT platforms typically follow a hub-and-spoke model:
- **Devices**: Edge sensors/actuators running MQTT client libraries.
- **Broker**: Mosquitto or HiveMQ handling pub/sub messaging.
- **Bridge**: Backend service subscribing to topics and routing to business logic.
- **Storage**: Time-series database optimized for high-write, aggregate-read workloads.
- **Rules Engine**: Evaluates incoming data against business rules in near-real-time.

## MQTT Topic Design

We use a hierarchical topic structure:
```
devices/{deviceId}/telemetry   → Device publishes sensor data
devices/{deviceId}/status      → Device publishes online/offline
devices/{deviceId}/command     → Server publishes commands to device
```

This allows fine-grained ACLs per device in production.

## Authentication Challenge

MQTT supports username/password and TLS client certificates. Our stub skips authentication entirely. In production:
1. Each device receives a unique X.509 certificate at manufacturing.
2. The broker verifies the certificate and maps the CN to a device ID.
3. HTTP endpoints verify JWT tokens signed by a device provisioning service.

## Time-Series Considerations

InfluxDB uses Line Protocol: `measurement,tag=value field=value timestamp`
TimescaleDB uses hypertables on PostgreSQL.
Both support downsampling and retention policies.

## Alerting Design

Rules need to be evaluated per incoming data point. For threshold alerts, this is straightforward. For duration-based alerts (e.g., temperature > 50C for 5 minutes), we need a stateful window or sliding time evaluation.
