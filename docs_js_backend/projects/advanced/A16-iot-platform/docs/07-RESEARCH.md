# Research & References

## MQTT Protocol
- MQTT Specification v5.0: https://docs.oasis-open.org/mqtt/mqtt/v5.0/mqtt-v5.0.html
- Mosquitto Documentation: https://mosquitto.org/documentation/
- MQTT.js Client: https://github.com/mqttjs/MQTT.js

## Time-Series Databases
- InfluxDB Line Protocol: https://docs.influxdata.com/influxdb/latest/reference/syntax/line-protocol/
- TimescaleDB Hypertables: https://docs.timescale.com/use-timescale/latest/hypertables/

## IoT Security
- OWASP IoT Top 10: https://owasp.org/www-project-internet-of-things/
- NIST IoT Device Cybersecurity Guidance: https://www.nist.gov/itl/applied-cybersecurity/nist-cybersecurity-iot-program
- X.509 Client Certificates in Mosquitto:
  ```
  require_certificate true
  use_identity_as_username true
  ```

## OTA Best Practices
- AWS IoT OTA Update Manager architecture
- Encrypted firmware images with signature verification
- Rollback capability on failed update
