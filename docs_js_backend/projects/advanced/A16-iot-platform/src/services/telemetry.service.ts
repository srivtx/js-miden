import { TelemetryPoint, TelemetryBatch, TelemetryQuery } from '../types/telemetry.types.js';
import { logger } from '../utils/logger.js';

// In-memory store (production: InfluxDB/TimescaleDB)
const telemetryStore = new Map<string, TelemetryPoint[]>();

export class TelemetryService {
  async ingest(point: TelemetryPoint): Promise<void> {
    const key = point.deviceId;
    const points = telemetryStore.get(key) || [];
    points.push(point);
    telemetryStore.set(key, points);
    logger.debug({ deviceId: point.deviceId }, 'Telemetry point ingested');
  }

  async ingestBatch(batch: TelemetryBatch): Promise<void> {
    const points = telemetryStore.get(batch.deviceId) || [];
    points.push(...batch.points);
    telemetryStore.set(batch.deviceId, points);
    logger.info({ deviceId: batch.deviceId, count: batch.points.length }, 'Telemetry batch ingested');
  }

  async query(query: TelemetryQuery): Promise<TelemetryPoint[]> {
    const points = telemetryStore.get(query.deviceId) || [];
    return points.filter((p) => {
      const ts = new Date(p.timestamp).getTime();
      return ts >= query.start.getTime() && ts <= query.end.getTime() && p.measurements[query.measurement] !== undefined;
    });
  }

  async getLatest(deviceId: string): Promise<TelemetryPoint | null> {
    const points = telemetryStore.get(deviceId) || [];
    return points.length > 0 ? points[points.length - 1] : null;
  }
}

export const telemetryService = new TelemetryService();
