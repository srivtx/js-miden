import mqtt from 'mqtt';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { parseTopic, validatePayload, buildTopic } from '../utils/mqtt.utils.js';
import { deviceService } from './device.service.js';
import { telemetryService } from './telemetry.service.js';
import { commandService } from './command.service.js';
import { alertService } from './alert.service.js';

/**
 * MQTT Bridge Service.
 * Connects to Mosquitto broker and bridges messages to internal services.
 */
export class MqttService {
  private client?: mqtt.MqttClient;

  async connect(): Promise<void> {
    this.client = mqtt.connect(config.mqttBrokerUrl);

    this.client.on('connect', () => {
      logger.info('Connected to MQTT broker');
      this.client!.subscribe('devices/+/telemetry', (err) => {
        if (err) {
          logger.error({ err }, 'Failed to subscribe to telemetry topic');
        } else {
          logger.info('Subscribed to devices/+/telemetry');
        }
      });

      this.client!.subscribe('devices/+/status', (err) => {
        if (err) {
          logger.error({ err }, 'Failed to subscribe to status topic');
        }
      });
    });

    this.client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload).catch((err) => {
        logger.error({ err, topic }, 'Error handling MQTT message');
      });
    });

    this.client.on('error', (err) => {
      logger.error({ err }, 'MQTT connection error');
    });
  }

  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    const parsed = parseTopic(topic);
    if (!parsed) {
      logger.warn({ topic }, 'Unknown topic format');
      return;
    }

    const data = validatePayload(payload);
    if (!data) return;

    // BUG: No device authentication. We trust the deviceId from the topic.
    const { deviceId, action } = parsed;

    switch (action) {
      case 'telemetry': {
        await telemetryService.ingest({
          deviceId,
          timestamp: new Date(),
          measurements: data as Record<string, number>,
        });
        await deviceService.updateStatus(deviceId, 'online');
        await alertService.evaluateRules(deviceId, data as Record<string, number>);
        break;
      }
      case 'status': {
        await deviceService.updateStatus(deviceId, (data as any).status || 'online');
        break;
      }
      default:
        logger.debug({ action }, 'Unhandled MQTT action');
    }
  }

  async publishCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      throw new Error('MQTT client not connected');
    }
    const topic = buildTopic(deviceId, 'command');
    this.client.publish(topic, JSON.stringify(command));
    logger.info({ topic, deviceId }, 'Published command');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end();
    }
  }
}

export const mqttService = new MqttService();
