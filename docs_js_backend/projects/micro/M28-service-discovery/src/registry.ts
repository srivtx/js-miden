import { randomUUID } from 'crypto';

export interface Service {
  id: string;
  name: string;
  url: string;
  registeredAt: number;
  lastHeartbeat: number;
}

const registry: Service[] = [];

export function registerService(name: string, url: string): Service {
  const service: Service = {
    id: randomUUID(),
    name,
    url,
    registeredAt: Date.now(),
    lastHeartbeat: Date.now(),
  };
  registry.push(service);
  return service;
}

export function getServices(name: string): Service[] {
  // BUG: No TTL filtering! Dead services are returned.
  return registry.filter(s => s.name === name);
}

export function updateHeartbeat(id: string): boolean {
  const service = registry.find(s => s.id === id);
  if (!service) return false;
  service.lastHeartbeat = Date.now();
  return true;
}

export function getRegistry(): Service[] {
  return registry;
}
