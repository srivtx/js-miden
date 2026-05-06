import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app, { server } from '../src/index.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import WebSocket from 'ws';

const prisma = new PrismaClient();

describe('Whiteboard', () => {
  let token: string;
  let userId: string;
  let roomId: string;

  beforeAll(async () => {
    await prisma.cursorEvent.deleteMany();
    await prisma.stroke.deleteMany();
    await prisma.roomMember.deleteMany();
    await prisma.session.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: { email: 'test@whiteboard.com', password: await bcrypt.hash('pass', 10), name: 'Test', color: '#3B82F6' },
    });
    userId = user.id;

    const login = await request(app).post('/api/auth/login').send({ email: 'test@whiteboard.com', password: 'pass' });
    token = login.body.token;

    const room = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Room' });
    roomId = room.body.id;
  });

  afterAll(async () => {
    server.close();
    await prisma.$disconnect();
  });

  it('should create a room', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Drawing Room', description: 'A room for drawing' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Drawing Room');
  });

  it('should list rooms', async () => {
    const res = await request(app).get('/api/rooms').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should join room and get ws token', async () => {
    const res = await request(app)
      .post(`/api/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.wsToken).toBeDefined();
  });

  it('should get room strokes', async () => {
    const res = await request(app).get(`/api/rooms/${roomId}/strokes`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('BUG: should broadcast to wrong room (demonstrates privacy leak)', async () => {
    // Create second room
    const room2 = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Room 2' });

    const join1 = await request(app)
      .post(`/api/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${token}`);
    const join2 = await request(app)
      .post(`/api/rooms/${room2.body.id}/join`)
      .set('Authorization', `Bearer ${token}`);

    const ws1 = new WebSocket(`ws://localhost:${process.env.PORT || 3005}/ws`);
    const ws2 = new WebSocket(`ws://localhost:${process.env.PORT || 3005}/ws`);

    await new Promise<void>((resolve) => {
      let ready = 0;
      const onOpen = () => {
        ready++;
        if (ready === 2) resolve();
      };
      ws1.on('open', onOpen);
      ws2.on('open', onOpen);
    });

    const receivedOnWs2: any[] = [];
    ws2.on('message', (data) => {
      receivedOnWs2.push(JSON.parse(data.toString()));
    });

    ws1.send(JSON.stringify({ type: 'auth', token: join1.body.wsToken }));
    ws2.send(JSON.stringify({ type: 'auth', token: join2.body.wsToken }));

    // Wait for auth
    await new Promise((r) => setTimeout(r, 200));

    ws1.send(
      JSON.stringify({
        type: 'stroke:start',
        strokeId: 'stroke-1',
        strokeType: 'PEN',
        color: '#000',
        width: 2,
      })
    );

    await new Promise((r) => setTimeout(r, 200));

    // Due to bug 2, ws2 (in different room) receives stroke from ws1
    const strokeMessages = receivedOnWs2.filter((m) => m.type === 'stroke:started');
    expect(strokeMessages.length).toBeGreaterThan(0);

    ws1.close();
    ws2.close();
  });
});
