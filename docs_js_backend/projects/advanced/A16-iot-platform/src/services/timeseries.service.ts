import { logger } from '../utils/logger.js';
import { TelemetryPoint, TelemetryQuery } from '../types/telemetry.types.js';

/**
 * Stub for InfluxDB / TimescaleDB integration.
 * In production: use @influxdata/influxdb-client or pg client.
 */
export class TimeSeriesService {
  async write(point: TelemetryPoint): Promise<void> {
    // In production: write to InfluxDB line protocol or TimescaleDB hypertable
    logger.debug({ deviceId: point.deviceId }, 'Time-series write (stub)');
  }

  async query(query: TelemetryQuery): Promise<TelemetryPoint[]> {
    // In production: execute Flux or SQL query
    logger.debug({ query }, 'Time-series query (stub)');
    return [];
  }

  async createBucket(name: string): Promise<void> {
    logger.info({ name }, 'Creating time-series bucket (stub)');
  }
}

export const timeSeriesService = new TimeSeriesService();
