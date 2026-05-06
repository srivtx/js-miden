import { describe, it, expect, beforeEach } from 'vitest';
import { RoutingService } from '../src/services/RoutingService.js';

describe('RoutingService', () => {
  let routing: RoutingService;

  beforeEach(() => {
    routing = new RoutingService();
  });

  it('should route user to specified region', () => {
    const region = routing.routeUser('user-1', 'us-west');
    expect(region).toBe('us-west');
  });

  it('should stick user to same region', () => {
    routing.routeUser('user-1', 'us-west');
    const region = routing.routeUser('user-1', 'eu-west');
    expect(region).toBe('us-west'); // Sticky routing
  });

  it('should route to lowest latency region', () => {
    routing.reportLatency('us-east', 20);
    routing.reportLatency('us-west', 50);
    routing.reportLatency('eu-west', 100);

    const region = routing.routeUser('user-1');
    expect(region).toBe('us-east');
  });

  it('should clear user route', () => {
    routing.routeUser('user-1', 'us-west');
    routing.clearRoute('user-1');
    expect(routing.getUserRegion('user-1')).toBeNull();
  });
});

describe('RoutingService - Multi-Region', () => {
  let routing: RoutingService;

  beforeEach(() => {
    routing = new RoutingService();
    routing.reportLatency('us-east', 20);
    routing.reportLatency('us-west', 50);
    routing.reportLatency('eu-west', 100);
  });

  it('should handle multiple users across regions', () => {
    const r1 = routing.routeUser('user-1');
    const r2 = routing.routeUser('user-2', 'us-west');
    const r3 = routing.routeUser('user-3', 'eu-west');

    expect(r1).toBe('us-east');
    expect(r2).toBe('us-west');
    expect(r3).toBe('eu-west');
  });
});