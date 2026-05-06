import { RouteRequest } from '../types/index.js';

export class RoutingService {
  private routes: Map<string, string> = new Map(); // userId -> region
  private regionLatencies: Map<string, number[]> = new Map();

  routeUser(userId: string, clientRegion?: string): string {
    // If user already has a sticky route, use it
    if (this.routes.has(userId)) {
      return this.routes.get(userId)!;
    }

    // Route to nearest region based on client location or lowest latency
    const region = clientRegion || this.getLowestLatencyRegion();
    this.routes.set(userId, region);
    return region;
  }

  reportLatency(region: string, latencyMs: number): void {
    const latencies = this.regionLatencies.get(region) || [];
    latencies.push(latencyMs);
    if (latencies.length > 100) latencies.shift();
    this.regionLatencies.set(region, latencies);
  }

  private getLowestLatencyRegion(): string {
    let bestRegion = 'us-east';
    let bestLatency = Infinity;

    for (const [region, latencies] of this.regionLatencies) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      if (avg < bestLatency) {
        bestLatency = avg;
        bestRegion = region;
      }
    }

    return bestRegion;
  }

  getUserRegion(userId: string): string | null {
    return this.routes.get(userId) || null;
  }

  clearRoute(userId: string): void {
    this.routes.delete(userId);
  }
}