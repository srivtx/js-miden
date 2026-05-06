# Problem Statement

Build an IoT device management platform that handles device registration, telemetry ingestion via MQTT, time-series data storage, remote device commands, and an alerting rules engine.

## Requirements

1. **Device Registration**: Onboard devices with metadata and firmware version tracking.
2. **MQTT Broker Integration**: Connect to Mosquitto to receive telemetry and send commands.
3. **Telemetry Ingestion**: High-throughput processing of sensor data points.
4. **Time-Series Storage**: Persist measurements for analytics and querying.
5. **Device Commands**: Support OTA updates, reboot, and remote configuration.
6. **Alerting Rules**: Threshold-based and duration-based alerting with multiple action types.

## Constraints

- Must support 10,000+ connected devices.
- Telemetry latency < 1 second from ingestion to storage.
- Commands must be delivered reliably with acknowledgment tracking.

## Known Issue

There is no device authentication on the MQTT bridge or HTTP ingestion endpoints. Any client can publish telemetry as any device ID, leading to data spoofing and unauthorized command execution.
