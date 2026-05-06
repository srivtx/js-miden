import { Router, Request, Response } from 'express';
import { storage } from './storage.js';

export interface Device {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'maintenance';
  lastSeen: number;
  registeredAt: number;
  metadata: Record<string, unknown>;
  authToken?: string;
}

export interface RegisterDeviceBody {
  name: string;
  type: string;
  metadata?: Record<string, unknown>;
}

const router = Router();

export function generateDeviceId(): string {
  return `dev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateAuthToken(): string {
  return `tok_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
}

export async function registerDevice(body: RegisterDeviceBody): Promise<Device> {
  const device: Device = {
    id: generateDeviceId(),
    name: body.name,
    type: body.type,
    status: 'offline',
    lastSeen: 0,
    registeredAt: Date.now(),
    metadata: body.metadata || {},
    authToken: generateAuthToken(),
  };
  await storage.saveDevice(device);
  return device;
}

export async function getDevice(id: string): Promise<Device | null> {
  return storage.getDevice(id);
}

export async function listDevices(): Promise<Device[]> {
  return storage.getAllDevices();
}

export async function updateDevice(id: string, updates: Partial<Device>): Promise<Device | null> {
  return storage.updateDevice(id, updates);
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const body = req.body as RegisterDeviceBody;
    if (!body.name || !body.type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    const device = await registerDevice(body);
    res.status(201).json(device);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  const devices = await listDevices();
  res.json(devices);
});

router.get('/:id', async (req: Request, res: Response) => {
  const device = await getDevice(req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  res.json(device);
});

router.patch('/:id', async (req: Request, res: Response) => {
  const device = await updateDevice(req.params.id, req.body);
  if (!device) {
    return res.status(404).json({ error: 'Device not found' });
  }
  res.json(device);
});

export default router;
export { router as deviceRouter };
