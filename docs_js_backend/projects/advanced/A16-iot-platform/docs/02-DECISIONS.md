# Architectural Decisions

## ADR-001: Mosquitto as MQTT Broker

**Decision**: Use Eclipse Mosquitto as the MQTT broker.

**Rationale**: Lightweight, open-source, widely documented, and easy to Dockerize. Suitable for curriculum without licensing complexity.

## ADR-002: InfluxDB Stub for Time-Series

**Decision**: Stub InfluxDB integration; use in-memory store for telemetry.

**Rationale**: Time-series setup requires significant resources. The stub documents the write/query interface while keeping the project runnable on student laptops.

## ADR-003: Rules Engine per Data Point

**Decision**: Evaluate alert rules synchronously on each telemetry ingestion.

**Rationale**: Simplest to implement and understand. Production would use a stream processing framework (Kafka Streams, Flink) or time-series database continuous queries.

## ADR-004: Command Queue via MQTT

**Decision**: Use MQTT retained messages and command acknowledgments for reliability.

**Rationale**: MQTT QoS 1 ensures at-least-once delivery. Acknowledgments track command execution state.

## ADR-005: No Authentication (Intentional Bug)

**Decision**: Omit device authentication to create a teachable security vulnerability.

**Rationale**: Students must understand that device identity must be cryptographically proven, not asserted.
