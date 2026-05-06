interface Backend {
  port: number;
  healthy: boolean;
}

const backends: Backend[] = [
  { port: 3001, healthy: true },
  { port: 3002, healthy: true },
  { port: 3003, healthy: true },
];

let counter = 0;

export function selectBackend(): Backend | null {
  // BUG: No health check filtering! All backends are selected regardless of health.
  if (backends.length === 0) return null;
  
  const backend = backends[counter % backends.length];
  counter++;
  return backend;
}

export function getBackends(): Backend[] {
  return backends;
}

export function setBackendHealth(port: number, healthy: boolean) {
  const backend = backends.find(b => b.port === port);
  if (backend) {
    backend.healthy = healthy;
  }
}
