// Health check module - currently not used by the balancer
// This is the intended implementation that is missing

import http from 'http';
import { getBackends, setBackendHealth } from './balancer.js';

export function checkHealth(backendPort: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${backendPort}/health`, { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

export function startHealthChecks(intervalMs: number = 5000) {
  // BUG: Health checks are never started!
  // setInterval(async () => {
  //   for (const backend of getBackends()) {
  //     const healthy = await checkHealth(backend.port);
  //     setBackendHealth(backend.port, healthy);
  //   }
  // }, intervalMs);
}
