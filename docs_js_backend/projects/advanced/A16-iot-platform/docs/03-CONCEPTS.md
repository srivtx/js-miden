# Core Concepts

## MQTT (Message Queuing Telemetry Transport)

A lightweight publish-subscribe messaging protocol designed for IoT:
- **Broker**: Routes messages between publishers and subscribers.
- **Topic**: Hierarchical string (e.g., `devices/123/telemetry`).
- **QoS Levels**:
  - QoS 0: At most once (fire and forget)
  - QoS 1: At least once (acknowledged)
  - QoS 2: Exactly once (four-way handshake)
- **Retain Flag**: Last message on a topic is stored and sent to new subscribers.
- **Last Will**: Message published by broker if client disconnects unexpectedly.

## Time-Series Databases

Optimized for workloads with:
- High write throughput (thousands of points/second)
- Time-based queries (last hour, last day)
- Aggregation (mean, max, min over intervals)

**InfluxDB**: Schema-on-write, tag-based indexing, Flux query language.
**TimescaleDB**: PostgreSQL extension with hypertables for automatic partitioning.

## OTA (Over-The-Air) Updates

Process for updating device firmware remotely:
1. Server publishes firmware URL and checksum to `devices/{id}/command`.
2. Device downloads firmware, verifies checksum.
3. Device flashes firmware and reboots.
4. Device publishes new firmware version to `devices/{id}/status`.

## Alerting Rules Engine

Components:
- **Condition**: Measurement, operator, threshold, optional duration.
- **Evaluation**: Triggered on data ingestion or scheduled polling.
- **Action**: Webhook, email, SMS, or MQTT publish.
- **State**: Track active alerts to prevent flapping.

## Device Authentication Methods

1. **Username/Password**: Simple but vulnerable to credential theft.
2. **X.509 Certificates**: Strong mutual TLS; each device has unique cert.
3. **JWT Tokens**: Short-lived tokens signed by provisioning service.
4. **HMAC Signatures**: Device signs payload with pre-shared key.
