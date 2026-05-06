import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  influxdbUrl: process.env.INFLUXDB_URL || 'http://localhost:8086',
  influxdbToken: process.env.INFLUXDB_TOKEN || 'iot-token',
  influxdbOrg: process.env.INFLUXDB_ORG || 'iot-org',
  influxdbBucket: process.env.INFLUXDB_BUCKET || 'telemetry',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  maxTelemetryBatchSize: 1000,
  alertEvaluationIntervalMs: 30000,
};
