export interface TelemetryPoint {
  deviceId: string;
  timestamp: Date;
  measurements: Record<string, number>;
  tags?: Record<string, string>;
}

export interface TelemetryBatch {
  deviceId: string;
  points: TelemetryPoint[];
}

export interface TelemetryQuery {
  deviceId: string;
  measurement: string;
  start: Date;
  end: Date;
  aggregation?: 'mean' | 'sum' | 'min' | 'max' | 'count';
  interval?: string;
}
