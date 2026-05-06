# Critique

## Strengths

1. **Protocol Realism**: MQTT integration with topic parsing and payload validation mirrors production IoT platforms.
2. **Rules Engine**: Simple but functional threshold alerting teaches event-driven architecture.
3. **Command Lifecycle**: Pending/sent/acknowledged state machine is a realistic representation of device command handling.
4. **Docker Compose**: Full stack with broker and database makes the project immediately runnable.

## Weaknesses

1. **No Persistence**: In-memory stores lose data on restart. Students should integrate PostgreSQL for devices and InfluxDB for telemetry.
2. **Synchronous Rule Evaluation**: Blocks the ingestion path. Production should use async stream processing.
3. **Missing Device Gateway**: Edge gateways (e.g., AWS Greengrass) are common in IoT but not represented.
4. **No Rate Limiting**: Devices could flood the broker and backend.

## Bug Severity: CRITICAL

The lack of device authentication is a critical vulnerability. In a real deployment, this would be exploited within hours. The fix requires infrastructure (certificate authority or key provisioning) which is a significant architectural addition.

## Suggested Improvements

1. Implement device JWT provisioning flow.
2. Add MQTT over TLS with client certificates.
3. Replace in-memory stores with PostgreSQL + InfluxDB.
4. Add telemetry batching and backpressure handling.
